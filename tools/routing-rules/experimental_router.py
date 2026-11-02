#!/usr/bin/env python3
"""Bounded Dijkstra on (graph node, directed segment history). Research only."""
import argparse
from collections import Counter, defaultdict
import heapq
import itertools
import math
from pathlib import Path
import sys
import time
import build_graph as bg
import turn_rules as tr
import via_way_rules as vw

VERSION='hanoi-dijkstra-experiment-0.2.0'


def distance(a,b):
    lon1,lat1=a;lon2,lat2=b
    x1,x2=math.radians(lat1),math.radians(lat2)
    h=math.sin((x2-x1)/2)**2+math.cos(x1)*math.cos(x2)*math.sin(math.radians(lon2-lon1)/2)**2
    return 2*6371008.8*math.asin(math.sqrt(min(1,max(0,h))))


def coordinate(value):
    if not isinstance(value,(list,tuple)) or len(value)!=2 or not all(isinstance(n,(float,int)) and not isinstance(n,bool) and math.isfinite(n) for n in value):raise ValueError('Tọa độ cần [longitude, latitude] hữu hạn')
    if not (-180<=value[0]<=180 and -90<=value[1]<=90):raise ValueError('Tọa độ ngoài phạm vi')
    return list(value)


class Router:
    def __init__(self,graph):
        self.g=graph;self.edges=graph['edges'];self.adj=defaultdict(list);self.ends=defaultdict(set)
        for eid,e in self.edges.items():
            if not math.isfinite(e['length_m']) or e['length_m']<=0:raise ValueError('Chi phí khoảng cách không dương/hữu hạn')
            if e['base_time_seconds'] is not None and (not math.isfinite(e['base_time_seconds']) or e['base_time_seconds']<=0):raise ValueError('Chi phí thời gian không dương/hữu hạn')
            self.adj[e['graph_from']].append(eid)
            for weight in ['distance','time']:
                if weight=='time' and e['base_time_seconds'] is None:continue
                self.ends[weight,'start'].add(e['graph_from']);self.ends[weight,'end'].add(e['graph_to'])
        self.weak={}
        for weight in ['distance','time']:
            parent={}
            def find(n):
                parent.setdefault(n,n)
                while parent[n]!=n:parent[n]=parent[parent[n]];n=parent[n]
                return n
            for e in self.edges.values():
                if weight=='time' and e['base_time_seconds'] is None:continue
                a,b=find(e['graph_from']),find(e['graph_to'])
                if a!=b:parent[a]=b
            self.weak[weight]={n:find(n) for n in parent}
        self.records=graph['turn_records'];self.last=defaultdict(set);self.first=defaultdict(set);self.limit=1;self.prefixes=set()
        for index,r in enumerate(self.records):
            if r['profile']!=graph['profile']:raise ValueError('Graph lẫn hồ sơ')
            if r['status']=='ready':
                for p in r.get('patterns',[]):self.last[tr.seg_key(p['incoming'])].add(index)
                for p in r.get('sequence_patterns',[]):
                    self.first[tr.seg_key(p['segments'][0])].add(index);self.limit=max(self.limit,len(p['segments'])-1)
                    keys=tuple(tr.seg_key(s) for s in p['segments'])
                    self.prefixes.update(keys[:n] for n in range(1,len(keys)))
            elif r['status'] in {'unresolved','invalid'}:
                for s in r.get('incoming_guards',[]):self.last[tr.seg_key(s)].add(index)
    def compact_history(self,history):
        keys=tuple(tr.seg_key(self.edges[eid]) for eid in history)
        for n in range(min(len(keys),self.limit),1,-1):
            if keys[-n:] in self.prefixes:return tuple(history[-n:])
        return tuple(history[-1:]) # last edge needed for static/local pending guards
    def check(self,history,out):
        raw=[self.edges[eid] for eid in history];indexes=set()
        if raw:indexes.update(self.last.get(tr.seg_key(raw[-1]),set()))
        for s in raw:indexes.update(self.first.get(tr.seg_key(s),set()))
        if not indexes:return 'not_blocked_by_evaluated_rules'
        # Evaluate relevant rules only, but keep GLOBAL history length outside this helper.
        return vw.RestrictionMachine([self.records[i] for i in sorted(indexes)],self.g['profile']).advance(raw,out)['state']
    def route_edges(self,*args,**kwargs):
        from edge_attachment import route_edges
        return route_edges(self,*args,**kwargs)
    def snap(self,point,role,weight,max_m):
        point=coordinate(point);best=None
        for gid in sorted(self.ends[weight,role]):
            n=self.g['nodes'][gid]
            if n.get('terminal_port') or not n.get('snap_eligible',False):continue
            d=distance(point,[n['lon'],n['lat']])
            if best is None or d<best['offset_m']:best={'graph_node':gid,'osm_node_id':n['osm_node_id'],'position':[n['lon'],n['lat']],'offset_m':d}
        return best if best and best['offset_m']<=max_m else None
    def route(self,start,end,weight='distance',mode='strict',max_snap_m=100,max_states=150000,max_seconds=15):
        if mode not in {'strict','diagnostic'} or weight not in {'distance','time'}:raise ValueError('Chế độ/trọng số không hợp lệ')
        if not 0<max_snap_m<=500 or not 1<=max_states<=500000 or not 0<max_seconds<=60:raise ValueError('Giới hạn tính toán không hợp lệ')
        coordinate(start);coordinate(end)
        coverage=self.g['strict_coverage_complete']
        result={'router_version':VERSION,'graph_version':self.g.get('graph_version'),'profile':self.g['profile'],'weight':weight,'mode':mode,'evaluated_at':self.g.get('evaluated_at'),
                'coverage_complete':coverage,'unsupported_shape_barrier_count':len(self.g.get('unsupported_shape_barriers',[])),'unlocated_pending_relations':self.g.get('unlocated_pending_turn_relations',[]),
                'warnings':['Research route on frozen graph; not a verified legal/safe route','Node snapping only: offsets are not validated access paths and excluded from cost','Base time uses assumed speeds, no traffic/signals/flood','Not shortest over every possible road attachment: nearest eligible node only'],
                'requested_start':list(start),'requested_end':list(end),'snap_limit_m':max_snap_m,'state':'not_started','route':None}
        if mode=='diagnostic':result['warnings'].append('Diagnostic mode: global unlocated restrictions are NOT proven irrelevant; local pending transitions still blocked')
        if mode=='strict' and not coverage:result.update(state='coverage_incomplete');return result
        a=self.snap(start,'start',weight,max_snap_m);b=self.snap(end,'end',weight,max_snap_m)
        result.update(snapped_start=a,snapped_end=b)
        if a is None or b is None:result['state']='snap_not_found';return result
        if a['graph_node']==b['graph_node']:result['state']='same_snapped_node';return result
        if self.weak[weight].get(a['graph_node'])!=self.weak[weight].get(b['graph_node']):
            result.update(state='no_route',no_route_reason='different_weak_components_after_graph_filters',expanded_states=0,discovered_states=0,rejections={});return result
        initial=(a['graph_node'],());dist={initial:0.0};parents={};serial=itertools.count();queue=[(0.0,next(serial),initial)];expanded=0;rejections=Counter();started=time.monotonic();goal=None
        while queue:
            if expanded>=max_states or len(dist)>max_states*4 or time.monotonic()-started>max_seconds:
                result.update(state='search_limit',expanded_states=expanded,discovered_states=len(dist),rejections=dict(rejections));return result
            cost,_,state=heapq.heappop(queue)
            if cost!=dist.get(state):continue
            node,history=state;expanded+=1
            if node==b['graph_node']:goal=state;break
            for eid in self.adj[node]:
                edge=self.edges[eid];step=edge['length_m'] if weight=='distance' else edge['base_time_seconds']
                if step is None:rejections['missing_time_cost']+=1;continue
                check=self.check(history,edge)
                if check!='not_blocked_by_evaluated_rules':rejections[check]+=1;continue
                nh=self.compact_history((*history,eid));ns=(edge['graph_to'],nh);nc=cost+step
                if nc<dist.get(ns,math.inf):dist[ns]=nc;parents[ns]=(state,eid);heapq.heappush(queue,(nc,next(serial),ns))
        result.update(expanded_states=expanded,discovered_states=len(dist),rejections=dict(rejections),search_seconds=time.monotonic()-started)
        if goal is None:result.update(state='no_route',no_route_reason='directed_or_turn_constraints_between_snapped_nodes');return result
        path=[];s=goal
        while s!=initial:s,eid=parents[s];path.append(eid)
        path.reverse();coords=[a['position']]+[[self.g['nodes'][self.edges[e]['graph_to']]['lon'],self.g['nodes'][self.edges[e]['graph_to']]['lat']] for e in path]
        length=sum(self.edges[e]['length_m'] for e in path)
        secs=None if any(self.edges[e]['base_time_seconds'] is None for e in path) else sum(self.edges[e]['base_time_seconds'] for e in path)
        result.update(state='found',edge_ids=path,length_m=length,base_time_seconds=secs,total_cost=dist[goal],cost_unit='m' if weight=='distance' else 's',
                      route={'type':'Feature','geometry':{'type':'LineString','coordinates':coords},'properties':{'mode':mode,'coverage_complete':coverage,'research_only':True}},
                      source_assumptions={'speed_assumed':any(self.edges[e].get('speed_assumed',True) for e in path),'missing_osm_speed_limits':sum(self.edges[e].get('limit_status')=='missing' for e in path)})
        return result


def main():
    p=argparse.ArgumentParser(description='Dijkstra thử nghiệm, node snapping, giữ lịch sử via-way')
    p.add_argument('--graph',type=Path,required=True);p.add_argument('--profile',choices=['car','motorcycle','walking'],default='car');p.add_argument('--start',required=True);p.add_argument('--end',required=True);p.add_argument('--weight',choices=['distance','time'],default='distance');p.add_argument('--diagnostic',action='store_true');p.add_argument('--max-snap',type=float,default=100);p.add_argument('--output',type=Path,default=Path('data/routing-experiments'))
    a=p.parse_args()
    try:
        from compare_graph_versions import checked_graph
        meta=bg.read_json(a.graph/'metadata.json')
        if meta.get('status')!='completed':raise ValueError('Graph chưa hoàn tất')
        graph=checked_graph(a.graph,meta,a.profile)
        r=Router(graph).route_edges([float(v) for v in a.start.split(',')],[float(v) for v in a.end.split(',')],a.weight,'diagnostic' if a.diagnostic else 'strict',a.max_snap)
        from datetime import datetime,timezone
        a.output.mkdir(parents=True,exist_ok=True);run=a.output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir();bg.write_json(run/'result.json',r)
        if r['route']:bg.write_json(run/'route.geojson',r['route'])
        print('Kết quả:',run.resolve());print(r['state'],'mode',r['mode'],'coverage',r['coverage_complete'])
        if r['state']=='found':print('Độ dài (m):',round(r['length_m'],1),'thời gian cơ sở (s):',r['base_time_seconds'])
        return 0
    except (OSError,ValueError,KeyError,TypeError) as exc:print('LỖI:',exc,file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
