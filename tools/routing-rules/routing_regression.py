#!/usr/bin/env python3
"""Fixed routing cases with explicit expectations; never rewrites the reference."""
import argparse,json
from pathlib import Path
from datetime import datetime,timezone
from experimental_router import Router
from compare_graph_versions import checked_graph
import build_graph as bg

def evaluate(router,case,expected):
    mode='strict' if router.g['profile']=='walking' else 'diagnostic'
    r=router.route_edges(case['start'],case['end'],case.get('weight','distance'),mode)
    passed=r['state']==expected['state']
    if expected['state']=='found':passed=passed and abs(r.get('length_m',float('inf'))-expected['length_m'])<=case.get('tolerance_m',1)
    return {'case_id':case['case_id'],'profile':router.g['profile'],'passed':passed,'expected':expected,'actual':r}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--graph',type=Path,required=True);ap.add_argument('--cases',type=Path,required=True);ap.add_argument('--output',type=Path,default=Path('data/routing-regression'));a=ap.parse_args()
    try:
        meta=bg.read_json(a.graph/'metadata.json');cases=bg.read_json(a.cases)
        if meta.get('status')!='completed' or meta['dataset_version']!=cases['dataset_version'] or meta['evaluated_at']!=cases['evaluated_at'] or meta['graph_version']!=cases['graph_version']:raise ValueError('Bộ ca cố định không khớp graph/dataset/thời điểm; cần đánh giá phiên bản mới, không tự cập nhật kỳ vọng')
        routers={p:Router(checked_graph(a.graph,meta,p)) for p in ['car','motorcycle','walking']};results=[]
        for c in cases['cases']:
            for p,e in c['expected'].items():results.append(evaluate(routers[p],c,e))
        run=a.output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir(parents=True)
        bg.write_json(run/'results.json',{'graph_version':meta['graph_version'],'passed':sum(r['passed'] for r in results),'total':len(results),'results':results})
        bg.ar.csv_write(run/'summary.csv',['case_id','profile','passed','state','length_m'],[{'case_id':r['case_id'],'profile':r['profile'],'passed':r['passed'],'state':r['actual']['state'],'length_m':r['actual'].get('length_m')} for r in results])
        print('Kết quả:',run.resolve());print('PASS',sum(r['passed'] for r in results),'/',len(results));return 0 if all(r['passed'] for r in results) else 1
    except (ValueError,KeyError,TypeError,OSError) as e:print('LỖI:',e);return 1
if __name__=='__main__':raise SystemExit(main())
