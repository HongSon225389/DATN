#!/usr/bin/env python3
"""Frozen, reviewed polygon closures on immutable graph edges. No depth safety inference."""
import argparse
from datetime import datetime
import hashlib,json,math
from pathlib import Path
from experimental_router import Router,coordinate

VERSION='hanoi-flood-overlay-0.1.0'
PROFILES={'car','motorcycle','walking'}

def instant(s):
    try:d=datetime.fromisoformat(s.replace('Z','+00:00'))
    except (AttributeError,ValueError,TypeError):raise ValueError('Thời gian ISO không hợp lệ')
    if d.tzinfo is None or d.utcoffset() is None:raise ValueError('Thời gian phải có múi giờ')
    return d

def cross(a,b,p):return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
def on_segment(p,a,b):return abs(cross(a,b,p))<=1e-12 and min(a[0],b[0])-1e-12<=p[0]<=max(a[0],b[0])+1e-12 and min(a[1],b[1])-1e-12<=p[1]<=max(a[1],b[1])+1e-12

def intersects(a,b,c,d):
    x,y,z,w=cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)
    return ((x>0 and y<0 or x<0 and y>0) and (z>0 and w<0 or z<0 and w>0)) or on_segment(c,a,b) or on_segment(d,a,b) or on_segment(a,c,d) or on_segment(b,c,d)

def polygon(geometry):
    if not isinstance(geometry,dict) or geometry.get('type')!='Polygon' or len(geometry.get('coordinates',[]))!=1:raise ValueError('Chỉ hỗ trợ Polygon một vòng, không có lỗ')
    ring=geometry['coordinates'][0]
    if not isinstance(ring,list) or not 4<=len(ring)<=2000 or ring[0]!=ring[-1]:raise ValueError('Polygon phải đóng, có 4..2000 tọa độ')
    for p in ring:coordinate(p)
    if len({tuple(p) for p in ring[:-1]})!=len(ring)-1:raise ValueError('Polygon có điểm lặp')
    if abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:])))<1e-14:raise ValueError('Polygon không có diện tích')
    segments=list(zip(ring,ring[1:]))
    for i,(a,b) in enumerate(segments):
        for j in range(i+2,len(segments)):
            if i==0 and j==len(segments)-1:continue
            if intersects(a,b,*segments[j]):raise ValueError('Polygon tự cắt')
    return ring

def inside(p,ring):
    state=False
    for a,b in zip(ring,ring[1:]):
        if on_segment(p,a,b):return True
        if (a[1]>p[1])!=(b[1]>p[1]) and p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]:state=not state
    return state

def hits(a,b,ring):return inside(a,ring) or inside(b,ring) or any(intersects(a,b,c,d) for c,d in zip(ring,ring[1:]))

def validate(document):
    if document.get('type')!='FeatureCollection' or document.get('data_mode') not in {'synthetic','reviewed_public_sources'}:raise ValueError('Thiếu FeatureCollection/data_mode')
    features=document.get('features');seen=set()
    if not isinstance(features,list) or len(features)>500:raise ValueError('Tối đa 500 vùng ngập')
    for f in features:
        if f.get('type')!='Feature':raise ValueError('Feature không hợp lệ')
        polygon(f.get('geometry'));p=f.get('properties',{});eid=p.get('event_id')
        if not isinstance(eid,str) or not eid or eid in seen:raise ValueError('event_id thiếu/trùng')
        seen.add(eid)
        if p.get('review_status') not in {'approved','pending','rejected'} or type(p.get('published')) is not bool:raise ValueError('Thiếu trạng thái duyệt/xuất bản')
        if p.get('status') not in {'flooded','rising','receded','unknown'}:raise ValueError('Trạng thái ngập không hợp lệ')
        if p.get('action')!='block' or not isinstance(p.get('profiles'),list) or not p['profiles'] or not set(p['profiles'])<=PROFILES:raise ValueError('Chỉ hỗ trợ action block và các profile tường minh')
        if instant(p.get('valid_until'))<=instant(p.get('valid_from')):raise ValueError('Khoảng hiệu lực không hợp lệ')
        if instant(p.get('observed_at'))>instant(p.get('valid_from')):raise ValueError('Quan sát sau thời điểm bắt đầu hiệu lực')
        depth=p.get('depth_cm')
        if depth is not None and (isinstance(depth,bool) or not isinstance(depth,(int,float)) or not math.isfinite(depth) or depth<0):raise ValueError('Độ sâu không hợp lệ')
        if document['data_mode']=='reviewed_public_sources':
            if not isinstance(p.get('source_url'),str) or not p['source_url'].startswith('https://') or not p.get('reviewer') or not p.get('source_title'):raise ValueError('Nguồn công khai cần URL https, tên nguồn, người duyệt')
    return document

class Overlay:
    def __init__(self,document):
        self.document=validate(document);self.digest=hashlib.sha256(json.dumps(document,sort_keys=True,ensure_ascii=False,allow_nan=False).encode()).hexdigest();self.cache={}
    def for_graph(self,graph):
        key=(graph.get('graph_version'),graph['profile'],graph['evaluated_at'])
        if key in self.cache:return self.cache[key]
        at=instant(graph['evaluated_at']);blocked={};decisions=[];active=[]
        for f in self.document['features']:
            p=f['properties'];reason='active'
            if p['review_status']!='approved' or not p['published']:reason='not_published_and_approved'
            elif graph['profile'] not in p['profiles']:reason='profile_not_selected'
            elif at<instant(p['valid_from']):reason='not_yet_effective'
            elif at>=instant(p['valid_until']):reason='expired_not_evidence_of_dryness'
            elif p['status'] not in {'flooded','rising'}:reason='status_requires_review_not_evidence_of_passability'
            matched=[]
            if reason=='active':
                active.append(f);ring=p['event_id'];coords=f['geometry']['coordinates'][0];west=min(x[0] for x in coords);east=max(x[0] for x in coords);south=min(x[1] for x in coords);north=max(x[1] for x in coords)
                for eid,e in graph['edges'].items():
                    a=graph['nodes'][e['graph_from']];b=graph['nodes'][e['graph_to']];a=[a['lon'],a['lat']];b=[b['lon'],b['lat']]
                    if max(a[0],b[0])<west or min(a[0],b[0])>east or max(a[1],b[1])<south or min(a[1],b[1])>north:continue
                    if hits(a,b,coords):blocked.setdefault(eid,[]).append(ring);matched.append(eid)
            decisions.append({'event_id':p['event_id'],'decision':reason,'matched_directed_edges':len(matched)})
        result={'overlay_version':VERSION,'overlay_hash':self.digest,'data_mode':self.document['data_mode'],'evaluated_at':graph['evaluated_at'],'profile':graph['profile'],'graph_version':graph.get('graph_version'),'blocked_edges':blocked,'decisions':decisions,'active_regions':{'type':'FeatureCollection','features':active},'warnings':['2D polygon intersection blocks every intersecting directed edge including elevated roads; review footprint and levels','Unobserved/expired/receded areas are not certified dry or passable','No flood depth threshold grants vehicle passage; active approved closures block specified profiles','Evaluation frozen at graph time, not predicted arrival time']}
        self.cache[key]=result;return result
    def compare(self,router,start,end,weight='distance',mode='strict',max_snap_m=100,**kwargs):
        overlay=self.for_graph(router.g)
        baseline=router.route_edges(start,end,weight,mode,max_snap_m,**kwargs)
        avoided=router.route_edges(start,end,weight,mode,max_snap_m,blocked_edge_ids=overlay['blocked_edges'],**kwargs)
        if avoided.get('state')=='found':
            sources={avoided.get('partial_edges',{}).get(eid,{}).get('source_edge_id',eid) for eid in avoided['edge_ids']}
            if sources.intersection(overlay['blocked_edges']):raise ValueError('Tuyến vẫn đi qua cạnh bị chặn')
        for r in [baseline,avoided]:
            r['warnings']=[w for w in r.get('warnings',[]) if 'no traffic/signals/flood' not in w]+['No live traffic/signals; flood closure coverage is incomplete']
        return {'state':avoided['state'],'baseline':baseline,'avoided':avoided,'overlay':overlay,'distance_delta_m':avoided['length_m']-baseline['length_m'] if all(r.get('state')=='found' for r in [baseline,avoided]) else None}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--graph',type=Path,required=True);ap.add_argument('--flood',type=Path,required=True);ap.add_argument('--profile',choices=sorted(PROFILES),default='car');ap.add_argument('--start',required=True);ap.add_argument('--end',required=True);ap.add_argument('--weight',choices=['distance','time'],default='distance');ap.add_argument('--diagnostic',action='store_true');ap.add_argument('--output',type=Path,default=Path('data/routing-flood'));a=ap.parse_args()
    from compare_graph_versions import checked_graph
    import build_graph as bg
    from datetime import timezone
    try:
        meta=bg.read_json(a.graph/'metadata.json')
        if meta.get('status')!='completed':raise ValueError('Graph chưa hoàn tất')
        g=checked_graph(a.graph,meta,a.profile);overlay=Overlay(bg.read_json(a.flood))
        r=overlay.compare(Router(g),[float(v) for v in a.start.split(',')],[float(v) for v in a.end.split(',')],a.weight,'diagnostic' if a.diagnostic else 'strict')
        run=a.output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir(parents=True);bg.write_json(run/'comparison.json',r)
        for key in ['baseline','avoided']:
            if r[key].get('route'):bg.write_json(run/(key+'.geojson'),r[key]['route'])
        print('Kết quả:',run.resolve());print('data_mode',r['overlay']['data_mode'],'blocked directed edges',len(r['overlay']['blocked_edges']));print('baseline',r['baseline']['state'],'avoided',r['avoided']['state'],'delta_m',r['distance_delta_m']);return 0
    except (ValueError,KeyError,TypeError,OSError) as e:print('LỖI:',e);return 1
if __name__=='__main__':raise SystemExit(main())
