#!/usr/bin/env python3
"""Compare graph/rule versions for the same snapshot/scope/frozen instant."""
import argparse
from datetime import datetime,timezone
import hashlib
from pathlib import Path
import sys
import build_graph as bg
from access_rules import csv_write


def checked_graph(run,meta,profile):
    name=profile+'.graph.json.gz';path=run/name
    if hashlib.sha256(path.read_bytes()).hexdigest()!=meta['output_sha256'][name]:raise ValueError('Hash graph không khớp: '+name)
    graph=bg.read_json(path)
    if graph['graph_version']!=meta['graph_version'] or graph['profile']!=profile:raise ValueError('Phiên bản/hồ sơ không khớp')
    return graph


def compare(old,new,output):
    old,new=Path(old),Path(new);a=bg.read_json(old/'metadata.json');b=bg.read_json(new/'metadata.json')
    if a.get('status')!='completed' or b.get('status')!='completed':raise ValueError('Cần hai graph hoàn tất')
    for key in ['dataset_version','raw_sha256','scope','evaluated_at']:
        if a.get(key)!=b.get(key):raise ValueError('Không cùng '+key+'; không dùng phép so sánh thay đổi bộ quy tắc này')
    rows=[];changes=[]
    for profile in ['car','motorcycle','walking']:
        ga=checked_graph(old,a,profile);gb=checked_graph(new,b,profile)
        rows.append({'profile':profile,'nodes_old':len(ga['nodes']),'nodes_new':len(gb['nodes']),'nodes_identical':ga['nodes']==gb['nodes'],
                     'edges_old':len(ga['edges']),'edges_new':len(gb['edges']),'edges_identical':ga['edges']==gb['edges'],
                     'unlocated_old':len(ga['unlocated_pending_turn_relations']),'unlocated_new':len(gb['unlocated_pending_turn_relations']),
                     'coverage_old':ga['strict_coverage_complete'],'coverage_new':gb['strict_coverage_complete']})
        ra={r['relation_id']:r for r in ga['turn_records']};rb={r['relation_id']:r for r in gb['turn_records']}
        for rid in sorted(ra.keys()|rb.keys()):
            aa,bb=ra.get(rid,{}),rb.get(rid,{})
            if any(aa.get(k)!=bb.get(k) for k in ['status','patterns','sequence_patterns','incoming_guards']):
                changes.append({'profile':profile,'relation_id':rid,'status_old':aa.get('status','missing'),'status_new':bb.get('status','missing'),
                                'time_state_old':aa.get('time_state',''),'time_state_new':bb.get('time_state',''),
                                'reason_old':aa.get('reason',''),'reason_new':bb.get('reason','')})
    output.mkdir(parents=True,exist_ok=True);run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
    csv_write(run/'graph-comparison.csv',list(rows[0]),rows)
    csv_write(run/'turn-changes.csv',['profile','relation_id','status_old','status_new','time_state_old','time_state_new','reason_old','reason_new'],changes)
    bg.write_json(run/'metadata.json',{'old_graph_version':a['graph_version'],'new_graph_version':b['graph_version'],'evaluated_at':a['evaluated_at'],'comparison_scope':'same snapshot/raw/scope/time; no source edits','changed_profile_relation_decisions':len(changes),'graph_modified_by_comparison':False})
    return run,rows,changes


def main():
    p=argparse.ArgumentParser(description='So sánh hai phiên bản graph cùng snapshot/phạm vi/thời điểm')
    p.add_argument('--old',type=Path,required=True);p.add_argument('--new',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('data/routing-graph-comparison'))
    a=p.parse_args()
    try:
        run,rows,changes=compare(a.old,a.new,a.output);print('Kết quả:',run.resolve())
        for r in rows:print(r['profile'],'nodes/edges identical',r['nodes_identical'],r['edges_identical'],'unlocated',r['unlocated_old'],'->',r['unlocated_new'],'coverage',r['coverage_new'])
        print('Quyết định relation/hồ sơ thay đổi:',len(changes));return 0
    except (OSError,ValueError,KeyError,TypeError) as exc:print('LỖI:',exc,file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
