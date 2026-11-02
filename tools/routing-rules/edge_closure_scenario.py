#!/usr/bin/env python3
"""Explicit synthetic closures from a validated spatial-review draft; no historical approval."""
import argparse,copy,hashlib,json
from datetime import datetime,timezone
from pathlib import Path
from historical_review import validate_draft
from flood_overlay import Overlay
from experimental_router import Router
import build_graph as bg
from compare_graph_versions import checked_graph

SCHEMA='edge-closure-scenario-0.1'

def sample_pair(graph,ids):
    blocked=set(ids);e=next((graph['edges'][i] for i in ids if graph['edges'][i]['direction']=='forward'),graph['edges'][ids[0]])
    incoming=[v for k,v in graph['edges'].items() if k not in blocked and v['graph_to']==e['graph_from']]
    outgoing=[v for k,v in graph['edges'].items() if k not in blocked and v['graph_from']==e['graph_to']]
    def choose(values):return min(values,key=lambda v:(v['way_id']!=e['way_id'],v['length_m'],v['edge_id'])) if values else None
    a,b=choose(incoming),choose(outgoing)
    if not a or not b:return None
    def midpoint(v):
        ns=[graph['nodes'][v[k]] for k in ['graph_from','graph_to']];return [(ns[0]['lon']+ns[1]['lon'])/2,(ns[0]['lat']+ns[1]['lat'])/2]
    return {'start':midpoint(a),'end':midpoint(b),'start_edge':a['edge_id'],'end_edge':b['edge_id'],'note':'Adjacent segment midpoints, synthetic test pair; not verified access points'}

def build_scenario(review,meta,graph,event_ids):
    if meta.get('status')!='completed' or review.get('dataset_version')!=meta['dataset_version'] or review.get('raw_sha256')!=meta['raw_sha256']:raise ValueError('Graph/dataset/source hash không khớp')
    validate_draft(review,graph,event_ids)
    ids=[f['properties']['edge_id'] for f in review['selected_edges']]
    if len(ids)!=2:raise ValueError('Kịch bản này yêu cầu đúng 2 cạnh trong phiếu; không tự thêm chiều')
    edges=[graph['edges'][i] for i in ids]
    if len({(e['way_id'],e['segment_index']) for e in edges})!=1 or {e['direction'] for e in edges}!={'forward','backward'}:raise ValueError('Hai cạnh phải là hai chiều của cùng một đoạn')
    if edges[0]['graph_from']!=edges[1]['graph_to'] or edges[0]['graph_to']!=edges[1]['graph_from']:raise ValueError('Hai cạnh không có đầu mút đảo nhau')
    return {'schema_version':SCHEMA,'data_mode':'synthetic','scenario_id':'TEST-'+review['event_id']+'-TWO-EDGES','description':'Kịch bản chặn hai chiều của đoạn do người nghiên cứu chọn; không xác nhận phạm vi ngập lịch sử','graph_version':meta['graph_version'],'dataset_version':meta['dataset_version'],'raw_sha256':meta['raw_sha256'],'evaluated_at':meta['evaluated_at'],'profile':review['profile'],'edge_ids':ids,'selected_edges':copy.deepcopy(review['selected_edges']),'draft_event_id':review['event_id'],'historical_event_date':review.get('event_date'),'source_reference':copy.deepcopy(review.get('source')),'draft_sha256':hashlib.sha256(json.dumps(review,sort_keys=True,ensure_ascii=False).encode()).hexdigest(),'created_at':datetime.now(timezone.utc).isoformat(),'test_pair':sample_pair(graph,ids),'limitations':['Selected boundary is a research assumption, not a verified flood footprint','Frozen graph evaluation time is not a claimed flood observation or recession time','Original draft and source graph remain unchanged']}

class EdgeScenario:
    compare=Overlay.compare
    def __init__(self,document,meta,graph):
        if document.get('schema_version')!=SCHEMA or document.get('data_mode')!='synthetic':raise ValueError('Chỉ nhận kịch bản cạnh giả lập')
        for key in ['graph_version','dataset_version','raw_sha256']:
            if document.get(key)!=meta[key]:raise ValueError('Kịch bản khác '+key)
        if document.get('evaluated_at')!=meta['evaluated_at'] or document.get('profile')!=graph['profile']:raise ValueError('Kịch bản khác profile/thời điểm')
        fake={'schema_version':'historical-spatial-review-0.1','graph_version':graph['graph_version'],'profile':graph['profile'],'event_id':document['draft_event_id'],'review_status':'draft','applied_to_routing':False,'selected_edges':document['selected_edges']}
        validate_draft(fake,graph,{document['draft_event_id']})
        ids=document.get('edge_ids');selected=[f['properties']['edge_id'] for f in document['selected_edges']]
        if ids!=selected or len(ids)!=2 or len(set(ids))!=2:raise ValueError('Danh sách phải đúng hai cạnh được chọn')
        es=[graph['edges'][i] for i in ids]
        if len({(e['way_id'],e['segment_index']) for e in es})!=1 or {e['direction'] for e in es}!={'forward','backward'}:raise ValueError('Không phải hai chiều của cùng đoạn')
        self.document=document;self.graph=graph;self.digest=hashlib.sha256(json.dumps(document,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    def for_graph(self,graph):
        if graph['graph_version']!=self.document['graph_version'] or graph['evaluated_at']!=self.document['evaluated_at']:raise ValueError('Kịch bản khác graph/thời điểm')
        applicable=graph['profile']==self.document['profile'];ids=self.document['edge_ids'] if applicable else []
        return {'overlay_version':SCHEMA,'overlay_hash':self.digest,'data_mode':'synthetic','overlay_kind':'explicit_edge_closure','scenario_id':self.document['scenario_id'],'description':self.document['description'],'evaluated_at':graph['evaluated_at'],'profile':graph['profile'],'applicable_profile':self.document['profile'],'graph_version':graph['graph_version'],'blocked_edges':{i:[self.document['scenario_id']] for i in ids},'decisions':[{'decision':'synthetic_explicit_closure' if applicable else 'profile_not_selected','matched_directed_edges':len(ids)}],'active_regions':{'type':'FeatureCollection','features':[]},'blocked_features':{'type':'FeatureCollection','features':self.document['selected_edges'] if applicable else []},'test_pair':self.document.get('test_pair') if applicable else None,'warnings':self.document['limitations']}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--graph',type=Path,required=True);ap.add_argument('--review',type=Path,required=True);ap.add_argument('--evidence',type=Path,default=Path(__file__).with_name('historical-evidence')/'intake-20250930.json');ap.add_argument('--output',type=Path,required=True);ap.add_argument('--compare-output',type=Path);a=ap.parse_args()
    try:
        review=bg.read_json(a.review);meta=bg.read_json(a.graph/'metadata.json');intake=bg.read_json(a.evidence)
        if review.get('profile') not in {'car','motorcycle','walking'}:raise ValueError('Profile không hợp lệ')
        item=next((e for e in intake['records'] if e['event_id']==review.get('event_id')),None)
        source=next((s for s in intake['sources'] if item and s['source_id']==item['source_id']),None)
        if not source or review.get('source',{}).get('url')!=source['url'] or review.get('event_date')!=item['event_date']:raise ValueError('Nguồn/ngày sự kiện không khớp hồ sơ')
        graph=checked_graph(a.graph,meta,review['profile']);doc=build_scenario(review,meta,graph,{e['event_id'] for e in intake['records']});overlay=EdgeScenario(doc,meta,graph)
        if a.output.exists():raise ValueError('Tệp output đã có; chọn tên mới để giữ mốc cũ')
        if a.output.resolve()==a.review.resolve():raise ValueError('Không ghi đè phiếu nháp')
        a.output.parent.mkdir(parents=True,exist_ok=True);bg.write_json(a.output,doc)
        print('Kịch bản:',a.output.resolve());print('GIẢ LẬP — chặn đúng:',', '.join(doc['edge_ids']))
        if a.compare_output:
            pair=doc['test_pair']
            if pair is None:raise ValueError('Đã lưu kịch bản nhưng thiếu cặp điểm tự chọn; chọn điểm trên viewer')
            result=overlay.compare(Router(graph),pair['start'],pair['end'],mode='strict' if graph['strict_coverage_complete'] else 'diagnostic',start_edge=pair['start_edge'],end_edge=pair['end_edge'])
            run=a.compare_output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir(parents=True);bg.write_json(run/'comparison.json',result)
            for kind in ['baseline','avoided']:
                if result[kind].get('route'):bg.write_json(run/(kind+'.geojson'),result[kind]['route'])
            print('So sánh:',run.resolve());print('mode',result['baseline'].get('mode'),'coverage',result['baseline'].get('coverage_complete'));print('baseline',result['baseline']['state'],result['baseline'].get('length_m'),'avoided',result['avoided']['state'],result['avoided'].get('length_m'))
        return 0
    except (ValueError,TypeError,KeyError,OSError) as e:print('LỖI:',e);return 1
if __name__=='__main__':raise SystemExit(main())
