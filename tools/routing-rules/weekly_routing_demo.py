"""Reproducible weekly demo on pinned OSM graph and synthetic flood."""
import argparse,json,sys
from pathlib import Path
from datetime import datetime,timezone
import compare_graph_versions as cg
from experimental_router import Router
from flood_overlay import Overlay
from route_timing import estimate,parse_request
import build_graph as bg

def main():
    p=argparse.ArgumentParser();p.add_argument('--graph',type=Path,required=True)
    p.add_argument('--flood',type=Path,default=Path(__file__).with_name('flood-demo.synthetic.geojson'))
    p.add_argument('--output',type=Path,default=Path('data/weekly-routing-demo'));a=p.parse_args()
    try:
        meta=bg.read_json(a.graph/'metadata.json')
        if meta.get('status')!='completed':raise ValueError('Graph chưa hoàn tất')
        graphs={p:cg.checked_graph(a.graph,meta,p) for p in ['car','motorcycle','walking']}
        overlay=Overlay(json.loads(a.flood.read_text(encoding='utf-8-sig')))
        if overlay.document['data_mode']!='synthetic':raise ValueError('Demo tuần này chỉ nhận lớp synthetic; không tự áp dữ liệu thật')
        stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run=a.output/stamp;run.mkdir(parents=True)
        records=[];rows=[]
        for profile in ['car','motorcycle','walking']:
            g=graphs[profile];router=Router(g);mode='strict' if g['strict_coverage_complete'] else 'diagnostic'
            for weight in ['distance','time']:
                result=overlay.compare(router,[105.813533,20.998173],[105.841535,21.005882],weight,mode)
                for kind in ['baseline','avoided']:
                    r=result[kind]
                    for timing,at in [('depart_at','2026-10-29T08:00:00+07:00'),('arrive_by','2026-10-29T09:00:00+07:00')]:
                        scheduled=estimate(r,parse_request(timing,at))
                        rows.append({'profile':profile,'weight':weight,'route_kind':kind,'mode':mode,'state':r['state'],
                                     'length_m':r.get('length_m'),'base_time_seconds':r.get('base_time_seconds'),
                                     'schedule_mode':timing,'schedule_state':scheduled['schedule']['state'],
                                     'estimated_departure':scheduled['schedule']['estimated_departure'],
                                     'estimated_arrival':scheduled['schedule']['estimated_arrival']})
                records.append({'profile':profile,'weight':weight,'comparison':result})
                print(profile,weight,'baseline',result['baseline']['state'],'avoided',result['avoided']['state'])
        bg.write_json(run/'results.json',{'graph_version':meta['graph_version'],'data_mode':'synthetic',
                      'schedule_method':'frozen_route_duration_estimate','time_dependent_routing':False,'records':records})
        bg.ar.csv_write(run/'summary.csv',list(rows[0]),rows)
        print('Kết quả:',run.resolve());print('Giờ đi/đến là ước tính tuyến cố định; chưa định tuyến theo thời gian.')
        return 0 if all(row['state']=='found' and row['schedule_state']=='estimated' for row in rows) else 1
    except (OSError,ValueError,KeyError,TypeError) as e:print('LỖI:',e,file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
