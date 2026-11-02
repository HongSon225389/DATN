#!/usr/bin/env python3
"""Diagnose unlocated pending turn relations, without repairing or changing coverage."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime,timezone
import json
from pathlib import Path
import sys
from inspect_graph import Dataset
from access_rules import csv_write
import build_graph as bg

VERSION='hanoi-pending-graph-0.1.0'


def graph_indexes(graph):
    ways=defaultdict(list);incoming=defaultdict(list);outgoing=defaultdict(list);nodes=defaultdict(list)
    for gid,n in graph['nodes'].items():nodes[n['osm_node_id']].append(gid)
    for eid,e in graph['edges'].items():
        ways[e['way_id']].append(eid);incoming[e['to_node']].append(eid);outgoing[e['from_node']].append(eid)
    return {'ways':ways,'incoming':incoming,'outgoing':outgoing,'nodes':nodes}


def diagnose(record,graph,elements,maps,indexes):
    members=record['members'];roles={role:[m for m in members if m.get('role')==role] for role in ['from','via','to']}
    missing=[role for role,ms in roles.items() if not ms]
    issues=['missing_'+role for role in missing]
    if len(roles['from'])>1:issues.append('multiple_from')
    if len(roles['to'])>1:issues.append('multiple_to')
    if any(m.get('type')!='way' for role in ['from','to'] for m in roles[role]):issues.append('wrong_from_to_type')
    if len(roles['via'])>1 and any(m.get('type')=='node' for m in roles['via']):issues.append('multiple_or_mixed_via_nodes')
    if any(m.get('type') not in {'node','way'} for m in roles['via']):issues.append('unsupported_via_type')
    if roles['via'] and all(m.get('type')=='way' for m in roles['via']) and record['locality']=='unlocated':issues.append('via_way_without_incoming_guard')
    if record['status']=='unresolved' and any(':conditional' in k for k in record.get('tags',{})) and any(text in record['reason'] for text in ['Điều kiện','điều kiện','cặp restriction']):issues.append('unresolved_time_condition')
    if len(roles['via'])==1 and roles['via'][0].get('type')=='node':
        via_id=roles['via'][0].get('ref')
        for role in ['from','to']:
            for m in roles[role]:
                raw=elements.get((m.get('type'),m.get('ref')))
                if raw and m.get('type')=='way' and via_id not in raw.get('nodes',[]):issues.append(role+'_not_connected_to_via_node')
    if any(m.get('role') not in roles for m in members):issues.append('unknown_member_role')
    missing_elements=[m for m in members if (m.get('type'),m.get('ref')) not in elements]
    if missing_elements:issues.append('missing_raw_element')
    details=[];all_graph_nodes=set();all_graph_edges=set();role_way_nodes={role:set() for role in ['from','via','to']}
    for m in members:
        typ,ref=m.get('type'),m.get('ref');raw=elements.get((typ,ref));eids=[];gids=set()
        if typ=='way':
            eids=indexes['ways'].get(ref,[])
            for eid in eids:
                e=graph['edges'][eid];gids.update([e['graph_from'],e['graph_to']])
            if raw and m.get('role') in role_way_nodes:role_way_nodes[m['role']].update(raw.get('nodes',[]))
        elif typ=='node':
            gids.update(indexes['nodes'].get(ref,[]))
            eids=sorted(set(indexes['incoming'].get(ref,[])+indexes['outgoing'].get(ref,[])))
        all_graph_nodes.update(gids);all_graph_edges.update(eids)
        node_control=graph.get('node_controls',{}).get(str(ref),graph.get('node_controls',{}).get(ref)) if typ=='node' else None
        details.append({'profile':graph['profile'],'relation_id':record['relation_id'],'role':m.get('role',''),'osm_type':typ,'osm_id':ref,'exists_in_raw':raw is not None,
                        'name':raw.get('tags',{}).get('name','') if raw else '',
                        'matched_graph_edges':len(eids),'matched_graph_nodes':len(gids),
                        'distance_wcc':sorted({maps['distance']['wcc'][n] for n in gids if n in maps['distance']['wcc']}),
                        'distance_scc':sorted({maps['distance']['scc'][n] for n in gids if n in maps['distance']['scc']}),
                        'time_wcc':sorted({maps['time']['wcc'][n] for n in gids if n in maps['time']['wcc']}),
                        'node_control_state':node_control.get('state','') if node_control else '',
                        'note':'Membership is only for known member elements, NOT proven restriction influence'})
    common=sorted(role_way_nodes['from'] & role_way_nodes['to']) if roles['from'] and roles['to'] else []
    # Candidate approaches are directions incident to a known via NODE, not inferred missing roles.
    via_nodes=[m['ref'] for m in roles['via'] if m.get('type')=='node' and ('node',m.get('ref')) in elements]
    candidates=[]
    for node in sorted(set(via_nodes)):
        for direction in ['incoming','outgoing']:
            eids=indexes[direction].get(node,[])
            candidates.append({'via_node':node,'direction':direction,'graph_edge_ids':sorted(eids),'way_ids':sorted({graph['edges'][eid]['way_id'] for eid in eids}),
                               'note':'Candidate incident edges only; cannot fill a missing from/to or override node barrier ports'})
    defects=issues or ['other_unlocated_or_unsupported']
    action='Rà soát cấu trúc quan hệ từ nguồn; giữ strict coverage khóa'
    if 'missing_from' in defects:action='Thiếu from: đối chiếu nguồn để biết hướng/way đi vào; cạnh tới via chỉ là ứng viên'
    elif 'missing_to' in defects:action='Thiếu to: đối chiếu nguồn để biết hướng/way bị cấm hoặc bắt buộc đi tới'
    elif 'missing_via' in defects:action='Thiếu via: nút chung from/to chỉ là gợi ý; không tự gán via-node hoặc loại trừ via-way'
    elif 'unresolved_time_condition' in defects:action='Đủ thành viên nhưng lịch chưa hỗ trợ: xử lý điều kiện trước, sau đó chuẩn hóa chuỗi via; không coi đây là lỗi thiếu from/to/via'
    elif any(k in defects for k in ['multiple_to','multiple_from','multiple_or_mixed_via_nodes']):action='Cấu trúc nhiều thành viên: rà soát loại restriction và thứ tự chuỗi; không tự chọn một phần'
    result={'profile':graph['profile'],'relation_id':record['relation_id'],'status':record['status'],'locality':record['locality'],'reason':record['reason'],
            'defects':defects,'missing_roles':missing,'role_counts':{k:len(v) for k,v in roles.items()},'missing_raw_elements':missing_elements,
            'known_member_graph_edges':len(all_graph_edges),'known_member_graph_nodes':len(all_graph_nodes),
            'known_member_wcc':sorted({maps['distance']['wcc'][n] for n in all_graph_nodes if n in maps['distance']['wcc']}),
            'known_member_scc':sorted({maps['distance']['scc'][n] for n in all_graph_nodes if n in maps['distance']['scc']}),
            'from_to_common_raw_nodes':common,'incident_candidates':candidates,'members':members,'tags':record['tags'],
            'member_hint_bbox':record['member_hint_bbox'],'osm_url':record['osm_url'],'next_action':action,
            'scope_proven':False,'repair_applied':False,'coverage_changed':False,
            'warning':'No graph match does NOT prove relation irrelevant; known member bounds/components are not a complete influence area'}
    return result,details


def analyze(data,include_local=False):
    results=[];details=[]
    for profile,graph in data.graphs.items():
        indexes=graph_indexes(graph);maps={weight:data.maps[profile,weight] for weight in ['distance','time']}
        for r in data.pending:
            if r['profile']!=profile or (not include_local and r['locality']!='unlocated'):continue
            result,member_rows=diagnose(r,graph,data.elements,maps,indexes);results.append(result);details+=member_rows
    return results,details


def export(data,output,include_local=False):
    results,details=analyze(data,include_local)
    output.mkdir(parents=True,exist_ok=True);run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
    rows=[]
    for r in results:
        rows.append({'profile':r['profile'],'relation_id':r['relation_id'],'status':r['status'],'locality':r['locality'],
                     'defects':';'.join(r['defects']),'missing_roles':';'.join(r['missing_roles']),
                     'from_count':r['role_counts']['from'],'via_count':r['role_counts']['via'],'to_count':r['role_counts']['to'],
                     'known_member_graph_edges':r['known_member_graph_edges'],'known_member_graph_nodes':r['known_member_graph_nodes'],
                     'known_member_wcc':';'.join(map(str,r['known_member_wcc'])),'from_to_common_raw_nodes':';'.join(map(str,r['from_to_common_raw_nodes'])),
                     'scope_proven':False,'next_action':r['next_action'],'osm_url':r['osm_url']})
    fields=list(rows[0]) if rows else ['profile','relation_id','defects']
    csv_write(run/'relation-diagnostics.csv',fields,rows)
    fields=['profile','relation_id','role','osm_type','osm_id','exists_in_raw','name','matched_graph_edges','matched_graph_nodes','distance_wcc','distance_scc','time_wcc','node_control_state','note']
    csv_write(run/'member-graph-matches.csv',fields,[{k:json.dumps(r[k],ensure_ascii=False) if isinstance(r[k],list) else r[k] for k in fields} for r in details])
    summary=[{'profile':p,'defect':defect,'decision_count':n} for (p,defect),n in sorted(Counter((r['profile'],d) for r in results for d in r['defects']).items())]
    csv_write(run/'defect-summary.csv',['profile','defect','decision_count'],summary)
    bg.write_json(run/'relation-diagnostics.json',results)
    bg.write_json(run/'metadata.json',{'version':VERSION,'graph_version':data.meta['graph_version'],'dataset_version':data.meta['dataset_version'],
                                      'scope':'all pending' if include_local else 'unlocated pending only','profile_decision_count':len(results),
                                      'unique_relation_count':len({r['relation_id'] for r in results}),'coverage_changed':False,'repair_applied':False,
                                      'counts_note':'defects overlap; member graph matches are not proven influence scope'})
    report=['# Chẩn đoán quan hệ pending trên graph','','Graph '+data.meta['graph_version']+'. Không thay dữ liệu, policy hoặc coverage.','','| Hồ sơ | Quan hệ | Lỗi cấu trúc | Cạnh graph khớp thành viên đã biết | Cụm WCC của thành viên |','|---|---:|---|---:|---|']
    for r in results:report.append('| '+r['profile']+' | '+str(r['relation_id'])+' | '+', '.join(r['defects'])+' | '+str(r['known_member_graph_edges'])+' | '+', '.join(map(str,r['known_member_wcc']))+' |')
    report+=['','Các nhóm lỗi có thể chồng nhau. Cụm WCC theo từng hồ sơ, mạng khoảng cách; ID không so trực tiếp giữa hồ sơ. Không có cạnh khớp không chứng minh lỗi nằm ngoài vùng/tuyến. Nút chung from/to và cạnh tới via chỉ là ứng viên rà soát, không tự khôi phục quan hệ.','','Chưa có quan hệ nào được chứng minh phạm vi ảnh hưởng đầy đủ. Chế độ nghiêm ngặt giữ nguyên; chưa chạy Dijkstra. Chi tiết từng member và đề xuất việc cần kiểm tra có trong JSON/CSV.']
    (run/'REPORT.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
    return run,results,summary


def main():
    p=argparse.ArgumentParser(description='Chẩn đoán thành viên thiếu và đối chiếu graph; không sửa hoặc mở coverage')
    p.add_argument('--graph',type=Path,required=True);p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--include-local',action='store_true');p.add_argument('--output',type=Path,default=Path('data/routing-pending-diagnostics'))
    a=p.parse_args()
    try:
        data=Dataset(a.graph,a.snapshot);run,results,summary=export(data,a.output,a.include_local);print('Kết quả:',run.resolve())
        for profile in ['car','motorcycle','walking']:
            rs=[r for r in results if r['profile']==profile]
            print(profile,'decisions',len(rs),'known member edge matches',sum(r['known_member_graph_edges']>0 for r in rs))
        for r in summary:print(r['profile'],r['defect'],r['decision_count'])
        print('Không tự khôi phục from/to/via. Không chứng minh phạm vi ảnh hưởng; coverage giữ nguyên.')
        return 0
    except (OSError,ValueError,KeyError,TypeError) as exc:print('LỖI:',exc,file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
