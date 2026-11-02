#!/usr/bin/env python3
"""Directed raw-segment graph, model policy and explainable coverage; no router."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import sys
import access_rules as ar
import direction_rules as dr
import barrier_speed_rules as bs
import turn_rules as tr
import via_way_rules as vw
import time_turn_rules as tt

VERSION='hanoi-graph-0.1.0'
POLICY={'version':'hanoi-combined-policy-0.1.0','allow_access':['allowed'],
        'allow_dimensions':['not_blocked_by_known_dimensions'],
        'allow_node_barrier':['allowed_by_model','not_a_barrier'],
        'unknown_speed':'distance_only','unknown_barrier':'split_terminal_ports_no_through',
        'pending_turn_local':'block_all_transitions_from_known_incoming_guard',
        'unlocated_pending_turn':'strict_routing_disabled_for_profile',
        'non_node_barriers':'shared_nodes_blocked; unlocated shapes flagged, no coordinate intersection inference',
        'time':'one frozen evaluation time; unsupported conditions remain pending',
        'missing_legal_speed_limit':'unknown; research speed assumption permitted',
        'flood':'not yet applied','search_state':'graph_node plus bounded directed segment history'}


def write_json(path,value):
    data=json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf-8')
    if path.name.endswith('.gz'):
        with path.open('wb') as f:
            with gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0) as z:z.write(data)
    else:path.write_bytes(data)


def read_json(path):
    if str(path).endswith('.gz'):
        with gzip.open(path,'rt',encoding='utf-8') as f:return json.load(f)
    return json.loads(Path(path).read_bytes())


def components(nodes,edges,time_only=False):
    """Topology ONLY: no turn-state restrictions. Iterative, no recursion depth limit."""
    adj=defaultdict(set);rev=defaultdict(set);weak=defaultdict(set);active=set()
    for e in edges.values():
        if time_only and e['base_time_seconds'] is None:continue
        a,b=e['graph_from'],e['graph_to'];active.update([a,b]);adj[a].add(b);rev[b].add(a);weak[a].add(b);weak[b].add(a)
    if not time_only:active=set(nodes)
    def groups(neighbors):
        seen=set();out=[]
        for start in sorted(active):
            if start in seen:continue
            stack=[start];seen.add(start);size=0
            while stack:
                u=stack.pop();size+=1
                for v in neighbors[u]:
                    if v not in seen:seen.add(v);stack.append(v)
            out.append(size)
        return out
    wcc=groups(weak);seen=set();order=[]
    for start in sorted(active):
        if start in seen:continue
        seen.add(start);stack=[(start,iter(sorted(adj[start])))]
        while stack:
            u,it=stack[-1]
            try:v=next(it)
            except StopIteration:order.append(u);stack.pop();continue
            if v not in seen:seen.add(v);stack.append((v,iter(sorted(adj[v]))))
    seen=set();scc=[]
    for start in reversed(order):
        if start in seen:continue
        stack=[start];seen.add(start);size=0
        while stack:
            u=stack.pop();size+=1
            for v in rev[u]:
                if v not in seen:seen.add(v);stack.append(v)
        scc.append(size)
    return dict(node_count=len(active),edge_count=sum(not time_only or e['base_time_seconds'] is not None for e in edges.values()),
                weak_components=len(wcc),largest_weak_nodes=max(wcc,default=0),strong_components=len(scc),largest_strong_nodes=max(scc,default=0),
                component_scope='segment topology after access/direction/dimensions/node barriers, BEFORE turn/via-way history constraints')


def select_ways(features,elements,scope):
    selected={}
    for feature in features:
        p=feature['properties'];sc=p.get('scope');wid=p.get('osm_way_id')
        if sc not in ({'study_intersection'} if scope=='study' else {'study_intersection','download_buffer'}):continue
        if p.get('osm_tags',{}).get('area')=='yes':continue
        way=elements.get(('way',wid))
        if not way:raise ValueError('Way GeoJSON thiếu trong raw')
        if wid in selected:raise ValueError('Way trùng trong GeoJSON')
        if p['osm_tags']!=way.get('tags',{}):raise ValueError('Tags GeoJSON khác raw')
        geom=feature.get('geometry') or {};ns=way.get('nodes',[])
        coords=geom.get('coordinates',[])
        if geom.get('type')!='LineString' or len(ns)<2 or len(coords)!=len(ns):raise ValueError('Hình học way không đầy đủ')
        for n,coord in zip(ns,coords):
            node=elements.get(('node',n))
            if not node or [node.get('lon'),node.get('lat')]!=coord:raise ValueError('Thứ tự/tọa độ node không khớp raw')
        bs.way_length_m(way,elements) # validates every coordinate
        selected[wid]=way
    return dict(sorted(selected.items()))


def node_decisions(ways,elements,profile,config):
    ids={n for w in ways.values() for n in w['nodes']};decisions={};shape_issues=[]
    for n in sorted(ids):
        tags=elements['node',n].get('tags',{})
        if tags.get('barrier'):
            result=bs.barrier(tags,profile,config)
            blocked=result['state'] not in POLICY['allow_node_barrier']
        elif any(k in tags or any(t.startswith(k+':') for t in tags) for k in bs.ACCESS[profile]):
            # A node's explicit access must not disappear just because barrier is absent.
            result=bs.barrier({**tags,'barrier':'entrance'},profile,config)
            blocked=result['state'] not in POLICY['allow_node_barrier']
            result['synthetic_check']='node access checked with entrance policy, no barrier invented in raw'
        else:
            dim=bs.dimensions(tags,profile,config);blocked=dim['state']!='not_blocked_by_known_dimensions'
            result={'state':dim['state'],'dimensions':dim,'reason':'Node dimensions only; no barrier tag'}
        if blocked or tags.get('barrier'):decisions[n]={'blocked':blocked,**result}
    # Shape barriers need geometry intersection processing; do not silently claim coverage.
    for e in elements.values():
        if e['type']=='node' or not e.get('tags',{}).get('barrier'):continue
        shared=ids & set(e.get('nodes',[]))
        shape_issues.append({'osm_type':e['type'],'osm_id':e['id'],'barrier':e['tags']['barrier'],'shared_selected_nodes':sorted(shared),'state':'unsupported_shape_barrier'})
        for n in shared:
            decisions[n]={'blocked':True,'state':'unresolved','reason':'Node chung với barrier dạng way/relation chưa diễn giải','shape_barrier_id':e['id']}
    return decisions,shape_issues


def build_profile(ways,elements,profile,config,access_rules,direction_rules,turn_records,at):
    controls,shape_issues=node_decisions(ways,elements,profile,config)
    nodes={};edges={};decisions=[];counts=Counter();assumptions=Counter()
    for wid,way in ways.items():
        tags=way.get('tags',{});dim=bs.dimensions(tags,profile,config)
        lengths=[bs.way_length_m({'nodes':way['nodes'][i:i+2]},elements) for i in range(len(way['nodes'])-1)]
        for direction in dr.classify(tags,profile,access_rules,direction_rules):
            d=direction['direction'];speed=bs.speed(tags,profile,d,config,at)
            reasons=[]
            if direction['state']!='allowed':reasons.append('access_direction:'+direction['state'])
            if dim['state']!='not_blocked_by_known_dimensions':reasons.append('way_dimensions:'+dim['state'])
            if tags.get('barrier'):reasons.append('way_barrier:unsupported')
            eligible=not reasons
            decisions.append(dict(way_id=wid,profile=profile,direction=d,eligible_distance=eligible,eligible_time=eligible and speed['state']=='estimated',reasons=';'.join(reasons),access_state=direction['access_state'],direction_state=direction['direction_state'],dimensions_state=dim['state'],speed_state=speed['state']))
            for reason in reasons:counts[reason]+=1
            if not eligible:continue
            for i,length in enumerate(lengths):
                seg=tr.segment(wid,i,d,way['nodes'])
                if seg['from_node']==seg['to_node'] or length<=0:
                    counts['degenerate_segment']+=1;continue
                def node_id(n):
                    blocked=controls.get(n,{}).get('blocked',False)
                    gid=f'b{n}:{wid}:{i}' if blocked else f'n{n}'
                    if gid not in nodes:
                        raw=elements['node',n];nodes[gid]={'osm_node_id':n,'lon':raw['lon'],'lat':raw['lat'],'terminal_port':blocked,'snap_eligible':not blocked}
                    return gid
                a,b=node_id(seg['from_node']),node_id(seg['to_node'])
                eid=f'{wid}:{i}:{d}'
                assumptions['access_default_or_warning']+=bool(direction['access_warning'])
                edges[eid]={**seg,'edge_id':eid,'graph_from':a,'graph_to':b,'length_m':length,
                            'base_time_seconds':bs.base_time_seconds(length,speed) if speed['state']=='estimated' else None,
                            'effective_kmh':speed['effective_kmh'],'osm_limit_kmh':speed['limit_kmh'],'limit_status':speed['limit_status'],
                            'estimated_free_kmh':speed['estimated_free_kmh'],'speed_assumed':True,
                            'access_key':direction['access_key'],'access_warning':direction['access_warning'],
                            'oneway_key':direction['oneway_key'],'oneway_value':direction['oneway_value'],
                            'name':tags.get('name',''),'highway':tags.get('highway',''),
                            'bridge':tags.get('bridge',''),'tunnel':tags.get('tunnel',''),'layer':tags.get('layer','')}
    records=[r for r in turn_records if r['profile']==profile]
    unresolved=[r for r in records if r['status'] in {'unresolved','invalid'}]
    unlocated=[r['relation_id'] for r in unresolved if not r['incoming_guards']]
    local=[r['relation_id'] for r in unresolved if r['incoming_guards']]
    adjacency=defaultdict(list)
    for eid,e in edges.items():adjacency[e['graph_from']].append(eid)
    complete=not unlocated and not shape_issues
    summary={'profile':profile,'distance_topology':components(nodes,edges),'time_topology':components(nodes,edges,True),
             'physical_osm_nodes_in_graph':len({n['osm_node_id'] for n in nodes.values()}),'virtual_terminal_ports':sum(n['terminal_port'] for n in nodes.values()),
             'blocked_control_nodes':sum(c['blocked'] for c in controls.values()),'way_direction_exclusion_reasons':dict(sorted(counts.items())), 'assumption_edge_counts':dict(assumptions),
             'local_pending_turn_relations':len(local),'unlocated_pending_turn_relations':len(unlocated),
             'unsupported_shape_barriers':len(shape_issues),'strict_coverage_complete':complete,
             'strict_routing_ready':False,'strict_routing_note':'Router/snap not implemented; coverage gate additionally blocks unlocated pending restrictions and unsupported shape barriers'}
    return {'profile':profile,'evaluated_at':tt.instant(at).isoformat(),'nodes':nodes,'edges':edges,'adjacency':dict(adjacency),
            'node_controls':controls,'turn_records':records,'unlocated_pending_turn_relations':unlocated,
            'unsupported_shape_barriers':shape_issues,'strict_coverage_complete':complete,'summary':summary},decisions


class GraphTransitions:
    """Guard for future router. Does not implement Dijkstra. Strict mode fails closed."""
    def __init__(self,graph,strict=True):
        self.g=graph;self.strict=strict
        self.machine=vw.RestrictionMachine(graph['turn_records'],graph['profile'])
    def advance(self,edge_history,outgoing_id,weight='distance'):
        if weight not in {'distance','time'}:raise ValueError('Chỉ hỗ trợ distance/time')
        if self.strict and not self.g['strict_coverage_complete']:
            return {'state':'coverage_incomplete','next_edge_history':list(edge_history),'coverage_complete':False}
        es=self.g['edges'];history=[es[e] for e in edge_history];out=es[outgoing_id]
        if any(a['graph_to']!=b['graph_from'] for a,b in zip(history,history[1:])):raise ValueError('Lịch sử graph không nối')
        if history and history[-1]['graph_to']!=out['graph_from']:return {'state':'invalid_transition','next_edge_history':list(edge_history)}
        if weight=='time' and (out['base_time_seconds'] is None or any(e['base_time_seconds'] is None for e in history)):
            return {'state':'missing_time_cost','next_edge_history':list(edge_history)}
        check=self.machine.advance(history,out)
        # Known local pending restrictions block conservatively. Global pending stay flagged in diagnostic mode.
        accepted=check['state']=='not_blocked_by_evaluated_rules'
        return {**check,'next_edge_history':([*edge_history,outgoing_id][-self.machine.limit:] if accepted else list(edge_history)),
                'cost':out['length_m'] if weight=='distance' else out['base_time_seconds'],'diagnostic_mode':not self.strict}


def build(snapshot,output,at,scope='study'):
    at=tt.instant(at);access_rules,ah=ar.load_rules();direction_rules,dh=dr.load_rules();config,ch=bs.load_config();turn_rules,th=tr.load_rules()
    meta=read_json(snapshot/'metadata.json');raw=(snapshot/'osm-raw.json').read_bytes();rawhash=hashlib.sha256(raw).hexdigest()
    if meta.get('status')!='completed' or (meta.get('raw_sha256') and meta['raw_sha256']!=rawhash):raise ValueError('Snapshot/hash không hợp lệ')
    els=json.loads(raw)['elements'];elements={}
    for e in els:
        key=(e['type'],e['id'])
        if key in elements and elements[key]!=e:raise ValueError('Phần tử raw trùng xung đột')
        elements[key]=e
    geo=(snapshot/'roads.geojson').read_bytes();ways=select_ways(json.loads(geo)['features'],elements,scope)
    rels=sorted((e for e in elements.values() if e['type']=='relation' and e.get('tags',{}).get('type')=='restriction'),key=lambda e:e['id'])
    turns=vw.evaluate_at(rels,elements,turn_rules,at)
    recipe={'builder_version':VERSION,'policy':POLICY,'dataset_version':meta['dataset_version'],'raw_sha256':rawhash,'roads_sha256':hashlib.sha256(geo).hexdigest(),
            'config_hashes':{'access':ah,'direction':dh,'barrier_speed':ch,'turn':th},'evaluated_at':at.isoformat(),'scope':scope,
            'implementation_hashes':{n:hashlib.sha256(Path(__file__).with_name(n).read_bytes()).hexdigest() for n in ['build_graph.py','access_rules.py','direction_rules.py','barrier_speed_rules.py','turn_rules.py','time_turn_rules.py','via_way_rules.py']}}
    graph_version='graph-'+hashlib.sha256(json.dumps(recipe,sort_keys=True).encode()).hexdigest()[:16]
    output.mkdir(parents=True,exist_ok=True);run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
    summaries=[];all_decisions=[]
    for p in bs.PROFILES:
        graph,decisions=build_profile(ways,elements,p,config,access_rules,direction_rules,turns,at)
        graph['graph_version']=graph_version;graph['dataset_version']=meta['dataset_version'];graph['policy_version']=POLICY['version']
        write_json(run/f'{p}.graph.json.gz',graph);summaries.append(graph['summary']);all_decisions+=decisions
    fields=['way_id','profile','direction','eligible_distance','eligible_time','reasons','access_state','direction_state','dimensions_state','speed_state']
    ar.csv_write(run/'way-decisions.csv',fields,all_decisions)
    rows=[]
    for s in summaries:
        rows.append({'profile':s['profile'],'nodes':s['distance_topology']['node_count'],'edges_distance':s['distance_topology']['edge_count'],'edges_time':s['time_topology']['edge_count'],
                     'weak_components':s['distance_topology']['weak_components'],'largest_weak_nodes':s['distance_topology']['largest_weak_nodes'],
                     'strong_components':s['distance_topology']['strong_components'],'largest_strong_nodes':s['distance_topology']['largest_strong_nodes'],
                     'terminal_ports':s['virtual_terminal_ports'],'unlocated_pending_turns':s['unlocated_pending_turn_relations'],
                     'unsupported_shape_barriers':s['unsupported_shape_barriers'],'strict_coverage_complete':s['strict_coverage_complete']})
    ar.csv_write(run/'summary.csv',list(rows[0]),rows)
    write_json(run/'connectivity.json',summaries);write_json(run/'policy-used.json',POLICY)
    for n in ['access-rules.v1.json','direction-rules.v1.json','barrier-speed-rules.v1.json','turn-rules.v1.json']:(run/n).write_bytes(Path(__file__).with_name(n).read_bytes())
    metadata={**recipe,'status':'completed','graph_version':graph_version,'source_way_count':len(ways),'source_node_count':len({n for w in ways.values() for n in w['nodes']}),
              'created_at':datetime.now(timezone.utc).isoformat(),'graph_created':True,'router_implemented':False,'flood_applied':False,
              'geometry_scope':'whole source ways intersecting selected scope, no clipping, no coordinate snapping; may extend outside bbox',
              'connectivity_note':'node/segment topology only, not turn-history state reachability; time topology may differ',
              'output_sha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(run.iterdir())}}
    write_json(run/'metadata.json',metadata)
    return run,rows


def main():
    p=argparse.ArgumentParser(description='Dựng graph segment có hướng và báo cáo kết nối; chưa tìm đường')
    p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--at',required=True);p.add_argument('--scope',choices=['study','download'],default='study');p.add_argument('--output',type=Path,default=Path('data/routing-graph'))
    a=p.parse_args()
    try:
        run,rows=build(a.snapshot,a.output,a.at,a.scope);print('Kết quả:',run.resolve())
        for r in rows:print(r['profile'],'nodes',r['nodes'],'edges distance/time',r['edges_distance'],r['edges_time'],'WCC/SCC',r['weak_components'],r['strong_components'],'coverage',r['strict_coverage_complete'])
        print('Graph thử nghiệm; chưa có Dijkstra/API/snap/ngập. Kết nối thống kê chưa xét trạng thái lịch sử rẽ; xem coverage và lỗi tồn đọng.')
        return 0
    except (OSError,ValueError,KeyError,TypeError) as e:print('LỖI:',e,file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
