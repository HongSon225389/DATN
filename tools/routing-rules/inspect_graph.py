#!/usr/bin/env python3
"""Graph component membership and pending restriction evidence. Read-only inputs."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import build_graph as bg
from access_rules import csv_write

VERSION='hanoi-graph-inspection-0.1.0'


def memberships(graph,weight='distance'):
    active=set();adj=defaultdict(set);rev=defaultdict(set);weak=defaultdict(set)
    for e in graph['edges'].values():
        if weight=='time' and e['base_time_seconds'] is None:continue
        a,b=e['graph_from'],e['graph_to'];active.update([a,b]);adj[a].add(b);rev[b].add(a);weak[a].add(b);weak[b].add(a)
    if weight=='distance':active=set(graph['nodes'])
    seen=set();weak_groups=[]
    for start in sorted(active):
        if start in seen:continue
        stack=[start];seen.add(start);group=[]
        while stack:
            u=stack.pop();group.append(u)
            for v in sorted(weak[u]):
                if v not in seen:seen.add(v);stack.append(v)
        weak_groups.append(group)
    seen=set();order=[]
    for start in sorted(active):
        if start in seen:continue
        stack=[(start,iter(sorted(adj[start])))];seen.add(start)
        while stack:
            u,it=stack[-1]
            try:v=next(it)
            except StopIteration:order.append(u);stack.pop();continue
            if v not in seen:seen.add(v);stack.append((v,iter(sorted(adj[v]))))
    seen=set();strong=[]
    for start in reversed(order):
        if start in seen:continue
        stack=[start];seen.add(start);group=[]
        while stack:
            u=stack.pop();group.append(u)
            for v in sorted(rev[u]):
                if v not in seen:seen.add(v);stack.append(v)
        strong.append(group)
    maps={};rows=[]
    for kind,groups in [('wcc',weak_groups),('scc',strong)]:
        groups.sort(key=lambda group:(-len(group),min(group)))
        mapping={n:index+1 for index,group in enumerate(groups) for n in group};maps[kind]=mapping
        internal=Counter();boundary=Counter()
        for e in graph['edges'].values():
            if weight=='time' and e['base_time_seconds'] is None:continue
            a,b=mapping[e['graph_from']],mapping[e['graph_to']]
            if a==b:internal[a]+=1
            else:boundary[a]+=1;boundary[b]+=1
        for index,group in enumerate(groups,1):
            ns=[graph['nodes'][n] for n in group];xs=[n['lon'] for n in ns];ys=[n['lat'] for n in ns]
            rows.append({'profile':graph['profile'],'weight':weight,'kind':kind,'component_id':index,'node_count':len(group),'internal_directed_edges':internal[index],
                         'boundary_incident_edges':boundary[index],'terminal_ports':sum(n['terminal_port'] for n in ns),
                         'west':min(xs),'south':min(ys),'east':max(xs),'north':max(ys),
                         'share_of_active_nodes':len(group)/len(active) if active else 0})
    return maps,rows


class Dataset:
    def __init__(self,graph_run,snapshot):
        self.run=Path(graph_run);self.meta=bg.read_json(self.run/'metadata.json')
        if self.meta.get('status')!='completed':raise ValueError('Graph chưa hoàn tất')
        smeta=bg.read_json(Path(snapshot)/'metadata.json');raw=(Path(snapshot)/'osm-raw.json').read_bytes()
        if smeta.get('dataset_version')!=self.meta['dataset_version'] or hashlib.sha256(raw).hexdigest()!=self.meta['raw_sha256']:raise ValueError('Snapshot không khớp graph')
        self.elements={(e['type'],e['id']):e for e in json.loads(raw)['elements']}
        self.graphs={};self.maps={};self.components=[];self.pending=[]
        for profile in ['car','motorcycle','walking']:
            filename=profile+'.graph.json.gz'
            if hashlib.sha256((self.run/filename).read_bytes()).hexdigest()!=self.meta['output_sha256'][filename]:raise ValueError('Hash graph không khớp')
            graph=bg.read_json(self.run/filename)
            if graph['graph_version']!=self.meta['graph_version'] or graph['profile']!=profile:raise ValueError('Phiên bản/hồ sơ graph không khớp')
            self.graphs[profile]=graph
            for weight in ['distance','time']:
                maps,rows=memberships(graph,weight);self.maps[profile,weight]=maps;self.components+=rows
            for r in graph['turn_records']:
                if r['status'] not in {'unresolved','invalid'}:continue
                hints=[]
                for m in r['members']:
                    e=self.elements.get((m['type'],m['ref']))
                    ns=[e] if e and e['type']=='node' else [self.elements.get(('node',n)) for n in e.get('nodes',[])] if e and e['type']=='way' else []
                    for node in ns:
                        if node and 'lat' in node and 'lon' in node:hints.append([node['lon'],node['lat']])
                bbox=[min(c[0] for c in hints),min(c[1] for c in hints),max(c[0] for c in hints),max(c[1] for c in hints)] if hints else None
                self.pending.append({'profile':profile,'relation_id':r['relation_id'],'status':r['status'],
                                     'locality':'local_guard' if r['incoming_guards'] else 'unlocated',
                                     'reason':r['reason'],'member_hint_bbox':bbox,'member_coordinates':hints,
                                     'members':r['members'],'tags':r['tags'],'osm_url':f"https://www.openstreetmap.org/relation/{r['relation_id']}",
                                     'scope_note':'Member geometry hint only; NOT proven influence area. Coverage unchanged.'})
    def info(self,profile,weight='distance',kind='wcc'):
        if profile not in self.graphs or weight not in {'distance','time'} or kind not in {'wcc','scc'}:raise ValueError('Bộ lọc không hợp lệ')
        g=self.graphs[profile]
        return {'graph_version':self.meta['graph_version'],'profile':profile,'weight':weight,'kind':kind,'summary':g['summary'],
                'components':[r for r in self.components if r['profile']==profile and r['weight']==weight and r['kind']==kind][:100],
                'component_count':sum(r['profile']==profile and r['weight']==weight and r['kind']==kind for r in self.components),
                'pending':[{k:v for k,v in r.items() if k not in {'member_coordinates','tags','members'}} for r in self.pending if r['profile']==profile],
                'note':'Topology before turn-history; pending member bbox is not an impact boundary; no routing/coverage changes'}
    def viewport(self,profile,weight,kind,bbox,component=0,limit=2000):
        self.info(profile,weight,kind)
        if len(bbox)!=4 or not all(isinstance(n,(int,float)) and bg.bs.math.isfinite(n) for n in bbox):raise ValueError('bbox không hợp lệ')
        w,s,e,n=bbox
        if not (-180<=w<e<=180 and -90<=s<n<=90):raise ValueError('bbox không hợp lệ')
        g=self.graphs[profile];mapping=self.maps[profile,weight][kind];features=[];total=0
        for edge in g['edges'].values():
            if weight=='time' and edge['base_time_seconds'] is None:continue
            a,b=g['nodes'][edge['graph_from']],g['nodes'][edge['graph_to']]
            ca,cb=mapping.get(edge['graph_from']),mapping.get(edge['graph_to'])
            if component and ca!=component and cb!=component:continue
            if max(a['lon'],b['lon'])<w or min(a['lon'],b['lon'])>e or max(a['lat'],b['lat'])<s or min(a['lat'],b['lat'])>n:continue
            total+=1
            if len(features)<limit:features.append({'type':'Feature','geometry':{'type':'LineString','coordinates':[[a['lon'],a['lat']],[b['lon'],b['lat']]]},'properties':{'edge_id':edge['edge_id'],'way_id':edge['way_id'],'direction':edge['direction'],'component_from':ca,'component_to':cb,'name':edge['name']}})
        blocked=[]
        for node_id,control in g['node_controls'].items():
            if not control['blocked']:continue
            raw=self.elements.get(('node',int(node_id)))
            if raw and w<=raw['lon']<=e and s<=raw['lat']<=n:blocked.append({'node_id':int(node_id),'lon':raw['lon'],'lat':raw['lat'],'state':control['state'],'reason':control.get('reason','')})
        return {'type':'FeatureCollection','features':features,'total_matching_edges':total,'returned_edges':len(features),'truncated':total>len(features),
                'blocked_nodes':blocked[:1000],'total_blocked_nodes_in_view':len(blocked),'blocked_truncated':len(blocked)>1000,
                'blocked_filter_note':'Blocked nodes independent of component filter; all controls in viewport',
                'component_filter_note':'SCC filter includes incident cross-component edges; colors identify source component'}
    def detail(self,profile,edge_id):
        g=self.graphs[profile]
        if edge_id not in g['edges']:raise KeyError('Không có cạnh')
        edge=g['edges'][edge_id]
        return {**edge,'osm_url':f"https://www.openstreetmap.org/way/{edge['way_id']}",'warning':'Edge present does not prove an entire route permitted; turn history and coverage still apply'}
    def export(self,output):
        output.mkdir(parents=True,exist_ok=True);run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
        fields=['profile','weight','kind','component_id','node_count','internal_directed_edges','boundary_incident_edges','terminal_ports','west','south','east','north','share_of_active_nodes']
        csv_write(run/'components.csv',fields,self.components)
        fields=['profile','relation_id','status','locality','reason','member_hint_bbox','osm_url','scope_note']
        csv_write(run/'pending-relations.csv',fields,[{**{k:r[k] for k in fields},'member_hint_bbox':json.dumps(r['member_hint_bbox'])} for r in self.pending])
        bg.write_json(run/'pending-relations.json',self.pending)
        for p in self.graphs:bg.write_json(run/(p+'.component-membership.json.gz'),{weight:self.maps[p,weight] for weight in ['distance','time']})
        bg.write_json(run/'metadata.json',{'version':VERSION,'graph_version':self.meta['graph_version'],'dataset_version':self.meta['dataset_version'],'source_graph_run':str(self.run.resolve()),'component_scope':'topology before turn history','coverage_changed':False})
        return run


def main():
    p=argparse.ArgumentParser(description='Phân tích cụm graph và quan hệ thiếu coverage, không sửa nguồn')
    p.add_argument('--graph',type=Path,required=True);p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('data/routing-graph-inspection'))
    a=p.parse_args()
    try:
        data=Dataset(a.graph,a.snapshot);run=data.export(a.output);print('Kết quả:',run.resolve())
        for profile in data.graphs:
            top=data.info(profile)['components'][:3]
            print(profile,'top WCC:',[(r['component_id'],r['node_count']) for r in top],'unlocated:',sum(r['profile']==profile and r['locality']=='unlocated' for r in data.pending))
        print('Không đổi coverage. Bbox thành viên chỉ gợi ý vị trí, chưa khoanh phạm vi ảnh hưởng.')
        return 0
    except (OSError,ValueError,KeyError,TypeError) as exc:print('LỖI:',exc,file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
