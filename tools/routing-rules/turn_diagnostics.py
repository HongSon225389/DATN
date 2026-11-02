#!/usr/bin/env python3
"""Group pending turn decisions without changing OSM or existing rules."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

from access_rules import csv_write
from turn_rules import load_rules

GROUPS={
    'conditional_time':('P1','Điều kiện chưa đánh giá','Viết bộ đánh giá giờ/ngày; giữ múi giờ và thời điểm yêu cầu rõ ràng'),
    'via_way':('P2','Via-way hoặc chuỗi via','Kiểm tra chuỗi kết nối và dùng trạng thái nhớ nhiều cạnh'),
    'exception_format':('P1','Định dạng/token except','Đối chiếu nguồn; lập bản sửa cục bộ có phê duyệt, không sửa OSM tự động'),
    'inline_condition':('P1','Điều kiện đặt trong khóa tĩnh','Đối chiếu rồi đề xuất tách sang restriction:conditional'),
    'member_shape':('P3','Thiếu/thừa/sai vai trò thành viên','Rà soát nguồn, không đoán đường vào/ra hoặc via'),
    'missing_member':('P3','Thiếu phần tử được tham chiếu','Kiểm tra tải đủ dữ liệu và bản nguồn trước khi kết luận quan hệ sai'),
    'disconnected':('P3','Thành viên không kết nối','Kiểm tra topology và nguồn; không tự nối đường'),
    'ambiguous_topology':('P2','Hướng vào/ra mơ hồ','Tách đoạn và ánh xạ cạnh có hướng trước khi áp dụng'),
    'only_conflict':('P3','Các only_* mâu thuẫn','Rà soát nhóm quan hệ cùng hướng vào, không tự chọn một quy tắc'),
    'mode_exception_conflict':('P3','Ngoại lệ và quy tắc riêng mâu thuẫn','Đối chiếu ngữ nghĩa nguồn trước khi đặt ưu tiên'),
    'unsupported_value':('P2','Giá trị hạn chế chưa hỗ trợ','Bổ sung đúng ngữ nghĩa loại quan hệ hoặc giữ ngoài phạm vi'),
    'other':('P3','Nguyên nhân khác/chưa nhận diện','Đọc tags/members và phiên bản bộ xử lý')
}
REASONS={
    'Có restriction theo điều kiện; chưa đánh giá thời gian, không áp dụng tag tĩnh thay thế':'conditional_time',
    'via-way/chuỗi via chưa hỗ trợ; cần trạng thái nhớ chuỗi cạnh':'via_way',
    'except có token lạ hoặc dấu phân cách chưa hỗ trợ':'exception_format',
    'Ngoại lệ có điều kiện chưa được diễn giải':'conditional_time',
    'Thiếu/thừa from/to/via hoặc sai loại thành viên':'member_shape',
    'Thiếu thành viên trong dữ liệu gốc':'missing_member',
    'from hoặc to không nối tới via node':'disconnected',
    'Có nhiều đoạn vào/ra cho cùng way tại via; cần tách hoặc rà soát topology':'ambiguous_topology',
    'Nhiều only_* cho cùng hướng vào nhưng mục tiêu không giao nhau; cần rà soát, chưa tự gộp':'only_conflict',
    'Ngoại lệ và restriction theo phương tiện cùng có mặt; cần rà soát ưu tiên':'mode_exception_conflict',
    'Loại hạn chế chưa hỗ trợ hoặc giá trị không chuẩn (gồm no_entry/no_exit)':'unsupported_value'
}
FIELDS=['relation_id','profile','status','primary_group','priority','group_label','reason',
        'findings','conditional_shape','except_raw','restriction_raw','conditional_raw',
        'from_count','via_node_count','via_way_count','to_count','recommended_action','osm_url']


def conditional_shape(value):
    # Shape detection only, NOT a schedule parser or validity guarantee.
    if not value:return ''
    match=re.fullmatch(r'\s*(?:no|only)_[a-z_]+\s*@\s*\((.*)\)\s*',value)
    if not match:return 'other_or_malformed'
    body=match[1].strip()
    if re.fullmatch(r'\d{2}:\d{2}-\d{2}:\d{2}(?:\s*[,;]\s*\d{2}:\d{2}-\d{2}:\d{2})*',body):
        return 'daily_time_shape_not_evaluated'
    if re.search(r'\b(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b',body):
        return 'weekday_or_holiday_shape_not_evaluated'
    return 'other_or_malformed'


def diagnose(record,elements,rules):
    tags=record['tags'];members=record['members'];profile=record['profile']
    keys=rules['profile_keys'][profile]
    relevant_conditions={k:tags[k] for key in keys for k in [key+':conditional'] if k in tags}
    raw_value=tags.get(record['rule_key'],'')
    group=REASONS.get(record['reason'],'other')
    if group=='unsupported_value' and '@' in raw_value:group='inline_condition'
    issues=[]
    roles={role:[m for m in members if m.get('role')==role] for role in ['from','via','to']}
    if relevant_conditions or 'except:conditional' in tags:issues.append('has_relevant_conditional')
    if '@' in raw_value:issues.append('condition_in_static_key')
    vn=sum(m.get('type')=='node' for m in roles['via'])
    vw=sum(m.get('type')=='way' for m in roles['via'])
    if vw:issues.append('via_way_multiple' if vw>1 else 'via_way_single')
    for role in ['from','to','via']:
        if not roles[role]:issues.append('missing_role_'+role)
    if len(roles['from'])>1:issues.append('multiple_from')
    if len(roles['to'])>1:issues.append('multiple_to')
    if vn>1 or (vn and vw):issues.append('mixed_or_multiple_via_nodes')
    if any(m.get('type')!='way' for m in roles['from']+roles['to']):issues.append('wrong_from_to_type')
    if any((m.get('type'),m.get('ref')) not in elements for m in members):issues.append('missing_referenced_element')
    except_raw=tags.get('except','')
    if ',' in except_raw:issues.append('except_comma_separator')
    if 'except=' in except_raw:issues.append('except_embedded_key')
    tokens=[s.strip() for s in except_raw.split(';') if s.strip()]
    unknown=set(tokens)-set(rules['known_exception_tokens'])
    if unknown:issues.append('except_unknown_token')
    if any('motorcyle' in token for token in unknown):issues.append('except_possible_motorcycle_typo')
    if record['reason'].startswith('Nhiều only_'):issues.append('only_conflict')
    priority,label,action=GROUPS[group]
    condition_text=' | '.join(relevant_conditions.values()) or (raw_value if '@' in raw_value else '')
    return {'relation_id':record['relation_id'],'profile':profile,'status':record['status'],
            'primary_group':group,'priority':priority,'group_label':label,'reason':record['reason'],
            'findings':';'.join(sorted(set(issues))),'conditional_shape':conditional_shape(condition_text),
            'except_raw':except_raw,'restriction_raw':raw_value,
            'conditional_raw':json.dumps(relevant_conditions,ensure_ascii=False),
            'from_count':len(roles['from']),'via_node_count':vn,'via_way_count':vw,'to_count':len(roles['to']),
            'recommended_action':action,'osm_url':f"https://www.openstreetmap.org/relation/{record['relation_id']}"}


def analyze(snapshot,turn_result,output):
    raw_bytes=(snapshot/'osm-raw.json').read_bytes();raw_hash=hashlib.sha256(raw_bytes).hexdigest()
    meta=json.loads((turn_result/'metadata.json').read_text(encoding='utf-8'))
    snapshot_meta=json.loads((snapshot/'metadata.json').read_text(encoding='utf-8'))
    if meta['dataset_version']!=snapshot_meta['dataset_version'] or meta['osm_raw_sha256']!=raw_hash:
        raise ValueError('Báo cáo chuyển hướng không thuộc cùng snapshot/hash dữ liệu')
    rules,rules_hash=load_rules(turn_result/'rules-used.json')
    if rules['version']!='hanoi-turn-0.1.0' or rules_hash!=meta['rules_sha256']:
        raise ValueError('Phiên bản hoặc hash cấu hình khác bộ chẩn đoán 0.1')
    record_bytes=(turn_result/'turn-rules.normalized.json').read_bytes();records=json.loads(record_bytes)
    raw=json.loads(raw_bytes);elements={(e['type'],e['id']):e for e in raw['elements']}
    rel_ids={e['id'] for e in raw['elements'] if e['type']=='relation' and e.get('tags',{}).get('type')=='restriction'}
    expected={(i,p) for i in rel_ids for p in rules['profile_keys']}
    actual={(r['relation_id'],r['profile']) for r in records}
    if actual!=expected or len(actual)!=len(records) or len(records)!=meta['profile_decision_count']:
        raise ValueError('Báo cáo chuyển hướng thiếu/trùng quan hệ hoặc phương tiện')
    for r in records:
        source=elements['relation',r['relation_id']]
        if r['tags']!=source.get('tags',{}) or r['members']!=source.get('members',[]):
            raise ValueError('Tags/members trong báo cáo khác dữ liệu gốc')
    pending=[r for r in records if r['status'] in {'unresolved','invalid'}]
    details=[diagnose(r,elements,rules) for r in pending]
    counts=Counter((d['profile'],d['status'],d['primary_group']) for d in details)
    findings=Counter((d['profile'],flag) for d in details for flag in d['findings'].split(';') if flag)
    summaries=[{'profile':p,'status':s,'primary_group':g,'group_label':GROUPS[g][1],
                'priority':GROUPS[g][0],'decision_count':v}
               for (p,s,g),v in sorted(counts.items())]
    output.mkdir(parents=True,exist_ok=True)
    run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
    csv_write(run/'pending-details.csv',FIELDS,details)
    csv_write(run/'group-summary.csv',['profile','status','primary_group','group_label','priority','decision_count'],summaries)
    csv_write(run/'overlapping-findings.csv',['profile','finding','decision_count'],
              [{'profile':p,'finding':f,'decision_count':v} for (p,f),v in sorted(findings.items())])
    groups=run/'groups';groups.mkdir()
    for group in sorted({d['primary_group'] for d in details}):
        csv_write(groups/(group+'.csv'),FIELDS,[d for d in details if d['primary_group']==group])
    by_relation=defaultdict(list)
    for d in details:by_relation[d['relation_id']].append(d)
    (run/'pending-relations.json').write_text(json.dumps([{'relation_id':key,'decisions':value,
         'tags':elements['relation',key].get('tags',{}),'members':elements['relation',key].get('members',[])}
         for key,value in sorted(by_relation.items())],ensure_ascii=False,indent=2),encoding='utf-8')
    result_meta={'dataset_version':meta['dataset_version'],'turn_rules_version':rules['version'],
                 'osm_raw_sha256':raw_hash,'normalized_input_sha256':hashlib.sha256(record_bytes).hexdigest(),
                 'created_at':datetime.now(timezone.utc).isoformat(),
                 'input_decision_count':len(records),'pending_decision_count':len(details),
                 'unique_pending_relations':len(by_relation),
                 'scope':'all relations in turn snapshot, including buffer/dependencies; not study-only',
                 'primary_groups':'exclusive per relation/profile decision; totals additive',
                 'findings':'overlapping; totals NOT additive',
                 'changed_source_or_rules':False,'graph_created':False}
    (run/'metadata.json').write_text(json.dumps(result_meta,ensure_ascii=False,indent=2),encoding='utf-8')
    return run,summaries,result_meta


def main(argv=None):
    parser=argparse.ArgumentParser(description='Phân nhóm unresolved/invalid; không sửa dữ liệu hoặc trạng thái')
    parser.add_argument('--snapshot',type=Path,required=True)
    parser.add_argument('--turn-result',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('data/routing-turn-diagnostics'))
    args=parser.parse_args(argv)
    try:
        run,summary,meta=analyze(args.snapshot,args.turn_result,args.output)
        print('Kết quả:',run.resolve())
        for r in summary:print(r['profile'],r['status'],r['primary_group'],r['decision_count'])
        print('Tổng quyết định chờ xử lý:',meta['pending_decision_count'])
        print('Số quan hệ duy nhất:',meta['unique_pending_relations'])
        print('Chỉ chẩn đoán; chưa sửa OSM/quy tắc, chưa chuyển trạng thái ready.')
        return 0
    except (OSError,ValueError,KeyError,TypeError) as exc:
        print('LỖI:',exc,file=sys.stderr);return 1


if __name__=='__main__':sys.exit(main())
