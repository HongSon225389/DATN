"""Read-only spatial review hints; selecting edges never creates routing closures."""
import json,math
from pathlib import Path
from experimental_router import coordinate

class HistoricalReview:
    def __init__(self,data,path):
        self.data=data;self.document=json.loads(Path(path).read_text(encoding='utf-8-sig'))
        records=self.document.get('records');sources=self.document.get('sources')
        if not isinstance(records,list) or not isinstance(sources,list):raise ValueError('Hồ sơ nguồn không hợp lệ')
        self.records={};self.sources={s['source_id']:s for s in sources}
        for r in records:
            if not isinstance(r.get('event_id'),str) or r['event_id'] in self.records or r.get('source_id') not in self.sources:raise ValueError('event/source thiếu hoặc trùng')
            if r.get('applied_to_routing') is not False:raise ValueError('Hồ sơ tiếp nhận phải chưa áp dụng định tuyến')
            self.records[r['event_id']]=r
    def catalog(self):
        return {'graph_version':self.data.meta['graph_version'],'dataset_version':self.data.meta['dataset_version'],'raw_sha256':self.data.meta['raw_sha256'],'evaluated_at':self.data.meta['evaluated_at'],'records':list(self.records.values()),'sources':list(self.sources.values()),'notice':'Location review only, no flood closure or routing changes'}
    def edge_feature(self,profile,eid):
        g=self.data.graphs[profile];e=g['edges'][eid]
        return {'type':'Feature','geometry':{'type':'LineString','coordinates':[[g['nodes'][e[k]]['lon'],g['nodes'][e[k]]['lat']] for k in ['graph_from','graph_to']]},'properties':{**e,'same_segment_edge_ids':[k for k,v in g['edges'].items() if v['way_id']==e['way_id'] and v['segment_index']==e['segment_index']],'osm_url':f"https://www.openstreetmap.org/way/{e['way_id']}"}}
    def candidates(self,event_id,profile,limit=1500):
        if profile not in self.data.graphs:raise ValueError('Profile không hợp lệ')
        r=self.records[event_id];g=self.data.graphs[profile];ids=set(r['candidate_way_ids_by_name_only']);features=[];allcoords=[];total=0
        if r['candidate_graph_version']!=g['graph_version']:raise ValueError('Gợi ý cũ khác graph; cần lập lại danh sách đối chiếu')
        for eid,e in sorted(g['edges'].items()):
            if e['way_id'] not in ids:continue
            total+=1;coords=[[g['nodes'][e[k]]['lon'],g['nodes'][e[k]]['lat']] for k in ['graph_from','graph_to']];allcoords+=coords
            if len(features)<limit:features.append({'type':'Feature','geometry':{'type':'LineString','coordinates':coords},'properties':{**e,'osm_url':f"https://www.openstreetmap.org/way/{e['way_id']}"}})
        bbox=[min(p[0] for p in allcoords),min(p[1] for p in allcoords),max(p[0] for p in allcoords),max(p[1] for p in allcoords)] if allcoords else None
        return {'type':'FeatureCollection','features':features,'event_id':event_id,'profile':profile,'graph_version':g['graph_version'],'bbox':bbox,'total_matching_edges':total,'returned_edges':len(features),'truncated':total>len(features),'warning':'Name-only hints including nearby alleys; NOT a verified flood boundary. Only edges present in this profile graph are shown.'}

def validate_draft(review,graph,event_ids):
    if review.get('schema_version')!='historical-spatial-review-0.1' or review.get('applied_to_routing') is not False or review.get('review_status')!='draft':raise ValueError('Chỉ nhận phiếu nháp, không phải lớp ngập')
    if review.get('graph_version')!=graph['graph_version'] or review.get('profile')!=graph['profile'] or review.get('event_id') not in event_ids:raise ValueError('Phiếu không khớp graph/profile/event')
    segments=review.get('selected_edges')
    if not isinstance(segments,list) or len(segments)>3000:raise ValueError('Danh sách cạnh không hợp lệ')
    seen=set()
    for feature in segments:
        eid=feature['properties']['edge_id']
        if eid in seen or eid not in graph['edges']:raise ValueError('Cạnh trùng/không có trong graph')
        seen.add(eid);e=graph['edges'][eid]
        coords=[[graph['nodes'][e[k]]['lon'],graph['nodes'][e[k]]['lat']] for k in ['graph_from','graph_to']]
        if feature.get('geometry')!={'type':'LineString','coordinates':coords}:raise ValueError('Hình học cạnh không khớp graph')
        for key in ['way_id','segment_index','direction','bridge','tunnel','layer']:
            if feature['properties'].get(key)!=e.get(key):raise ValueError('Định danh cạnh không khớp')
    if review.get('landmark') is not None:coordinate(review['landmark'])
    for key in ['landmark_source_url','footprint_evidence_url']:
        url=review.get(key,'')
        if not isinstance(url,str) or (url and not url.startswith('https://')):raise ValueError('Nguồn bổ sung phải là URL https')
    return True


def main():
    import argparse
    from compare_graph_versions import checked_graph
    import build_graph as bg
    ap=argparse.ArgumentParser();ap.add_argument('--graph',type=Path,required=True);ap.add_argument('--review',type=Path,required=True);ap.add_argument('--evidence',type=Path,default=Path(__file__).with_name('historical-evidence')/'intake-20250930.json');a=ap.parse_args()
    try:
        r=json.loads(a.review.read_text(encoding='utf-8-sig'))
        if r.get('profile') not in {'car','motorcycle','walking'}:raise ValueError('Profile không hợp lệ')
        intake=json.loads(a.evidence.read_text(encoding='utf-8-sig'));meta=bg.read_json(a.graph/'metadata.json');g=checked_graph(a.graph,meta,r['profile'])
        if meta.get('status')!='completed' or r.get('dataset_version')!=meta['dataset_version'] or r.get('raw_sha256')!=meta['raw_sha256']:raise ValueError('Dataset/source hash không khớp')
        item=next((e for e in intake['records'] if e['event_id']==r.get('event_id')),None)
        source=next((s for s in intake['sources'] if item and s['source_id']==item['source_id']),None)
        if not source or r.get('source',{}).get('source_id')!=source['source_id'] or r.get('source',{}).get('url')!=source['url'] or r.get('event_date')!=item['event_date']:raise ValueError('Nguồn hoặc ngày sự kiện khác hồ sơ gốc')
        validate_draft(r,g,{e['event_id'] for e in intake['records']});print('PASS cấu trúc/định danh/hình học:',len(r['selected_edges']),'cạnh. Chưa xác minh phạm vi ngập hoặc thời gian; chưa áp dụng định tuyến.');return 0
    except (ValueError,TypeError,KeyError,OSError) as e:print('LỖI:',e);return 1
if __name__=='__main__':raise SystemExit(main())
