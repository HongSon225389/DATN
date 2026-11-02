#!/usr/bin/env python3
"""Normalize turn relations; never interpret missing restriction as legal access."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

from access_rules import csv_write

RULES_PATH=Path(__file__).with_name('turn-rules.v1.json')


def load_rules(path=RULES_PATH):
    raw=Path(path).read_bytes();rules=json.loads(raw)
    if set(rules['profile_keys'])!={'car','motorcycle','walking'}:raise ValueError('Thiếu cấu hình ba phương tiện')
    return rules,hashlib.sha256(raw).hexdigest()


def segment(way_id,index,direction,nodes):
    a,b=nodes[index:index+2]
    return {'way_id':way_id,'segment_index':index,'direction':direction,
            'from_node':a if direction=='forward' else b,
            'to_node':b if direction=='forward' else a}


def seg_key(s):
    return (s['way_id'],s['segment_index'],s['direction'],s['from_node'],s['to_node'])


def incoming_segments(way,via):
    nodes=way.get('nodes',[]);out=[]
    for i,(a,b) in enumerate(zip(nodes,nodes[1:])):
        if a==b:continue
        if b==via:out.append(segment(way['id'],i,'forward',nodes))
        if a==via:out.append(segment(way['id'],i,'backward',nodes))
    return out


def outgoing_segments(way,via):
    nodes=way.get('nodes',[]);out=[]
    for i,(a,b) in enumerate(zip(nodes,nodes[1:])):
        if a==b:continue
        if a==via:out.append(segment(way['id'],i,'forward',nodes))
        if b==via:out.append(segment(way['id'],i,'backward',nodes))
    return out


def reverse_segment(s):
    return {**s,'direction':'backward' if s['direction']=='forward' else 'forward',
            'from_node':s['to_node'],'to_node':s['from_node']}


def normalize(rel,profile,elements,rules):
    tags=rel.get('tags',{});members=rel.get('members',[])
    result={'relation_id':rel['id'],'profile':profile,'status':'unresolved','reason':'',
            'rule_key':'','rule_value':'','except_tokens':[],'tags':tags,'members':members,
            'patterns':[],'incoming_guards':[],'rules_version':rules['version'],
            'applied_to_graph':False}
    def finish(status,reason):result.update(status=status,reason=reason);return result
    # Keep localized incoming guards even for pending rules if a via node is known.
    via=[m for m in members if m.get('role')=='via']
    froms=[m for m in members if m.get('role')=='from']
    tos=[m for m in members if m.get('role')=='to']
    if len(via)==1 and via[0].get('type')=='node':
        for m in froms:
            way=elements.get(('way',m.get('ref'))) if m.get('type')=='way' else None
            if way:result['incoming_guards']+=incoming_segments(way,via[0]['ref'])
    if tags.get('type')!='restriction':return finish('invalid','Không phải type=restriction được hỗ trợ')
    keys=rules['profile_keys'][profile]
    chosen=next((k for k in keys if k in tags or k+':conditional' in tags),None)
    if chosen is None:return finish('not_applicable','Không có restriction áp dụng cho phương tiện; đi bộ không kế thừa restriction chung của xe')
    result['rule_key']=chosen
    result['rule_value']=tags.get(chosen,tags.get(chosen+':conditional',''))
    tokens=[t.strip() for t in tags.get('except','').split(';') if t.strip()]
    result['except_tokens']=tokens
    if 'except:conditional' in tags:return finish('unresolved','Ngoại lệ có điều kiện chưa được diễn giải')
    if set(tokens)-set(rules['known_exception_tokens']):
        return finish('unresolved','except có token lạ hoặc dấu phân cách chưa hỗ trợ')
    exempt=bool(set(tokens)&set(rules['exception_tokens'][profile]))
    if exempt:
        if chosen!='restriction':return finish('unresolved','Ngoại lệ và restriction theo phương tiện cùng có mặt; cần rà soát ưu tiên')
        return finish('exempt','Phương tiện nằm trong except, không áp dụng hạn chế chung này')
    relevant_conditions={k:tags[k] for key in keys for k in [key+':conditional'] if k in tags}
    if relevant_conditions:return finish('unresolved','Có restriction theo điều kiện; chưa đánh giá thời gian, không áp dụng tag tĩnh thay thế')
    value=tags.get(chosen,'').strip()
    if value not in rules['no_values']+rules['only_values']:
        return finish('unresolved','Loại hạn chế chưa hỗ trợ hoặc giá trị không chuẩn (gồm no_entry/no_exit)')
    if not (len(froms)==1 and len(tos)==1 and via and all(m.get('type')=='way' for m in froms+tos)):
        return finish('invalid','Thiếu/thừa from/to/via hoặc sai loại thành viên')
    missing=[m for m in members if (m.get('type'),m.get('ref')) not in elements]
    if missing:return finish('invalid','Thiếu thành viên trong dữ liệu gốc')
    if any(m.get('role') not in {'from','via','to'} for m in members):
        return finish('unresolved','Có vai trò thành viên bổ sung chưa hỗ trợ')
    if not (len(via)==1 and via[0].get('type')=='node'):
        return finish('unresolved','via-way/chuỗi via chưa hỗ trợ; cần trạng thái nhớ chuỗi cạnh')
    via_id=via[0]['ref'];fw=elements[('way',froms[0]['ref'])];tw=elements[('way',tos[0]['ref'])]
    inc=incoming_segments(fw,via_id);out=outgoing_segments(tw,via_id)
    if not inc or not out:return finish('invalid','from hoặc to không nối tới via node')
    same=fw['id']==tw['id']
    patterns=[]
    if same:
        if value not in {'no_u_turn','only_u_turn'}:
            return finish('unresolved','from=to nhưng không phải quy tắc quay đầu; không tự chặn toàn way')
        for incoming in inc:
            reverse=reverse_segment(incoming)
            if not any(seg_key(reverse)==seg_key(s) for s in out):
                return finish('invalid','Không tìm thấy đoạn đảo chiều tương ứng')
            patterns.append({'incoming':incoming,'targets':[reverse],
                             'action':'only' if value.startswith('only_') else 'no'})
    else:
        # A via node in the middle/closed way can create ambiguous approaches.
        if len(inc)!=1 or len(out)!=1:
            return finish('unresolved','Có nhiều đoạn vào/ra cho cùng way tại via; cần tách hoặc rà soát topology')
        patterns=[{'incoming':inc[0],'targets':[out[0]],'action':'only' if value.startswith('only_') else 'no'}]
    result['patterns']=patterns
    return finish('ready','Đã chuẩn hóa quy tắc tĩnh qua một via node; chưa gắn vào graph')


def mark_only_conflicts(records):
    groups=defaultdict(list)
    for record in records:
        if record['status']=='ready':
            for pattern in record['patterns']:
                if pattern['action']=='only':groups[record['profile'],seg_key(pattern['incoming'])].append((record,pattern))
    for group in groups.values():
        common=None
        for _,pattern in group:
            targets={seg_key(t) for t in pattern['targets']}
            common=targets if common is None else common&targets
        if len(group)>1 and not common:
            for record,_ in group:
                record['status']='unresolved'
                record['reason']='Nhiều only_* cho cùng hướng vào nhưng mục tiêu không giao nhau; cần rà soát, chưa tự gộp'
    return records


def evaluate_transition(records,profile,incoming,outgoing):
    """Local rule check only. Never grants access/direction or global permission."""
    if incoming['to_node']!=outgoing['from_node']:
        return {'state':'invalid_transition','blocking_relations':[],
                'pending_local_relations':[],'unlocated_pending_relations':[],
                'coverage_complete':False,'note':'Hai đoạn không nối nhau; chưa phải chuyển tiếp hợp lệ'}
    relevant=[r for r in records if r['profile']==profile]
    blocked=[];pending=[];unlocated=[]
    for record in relevant:
        if record['status']=='ready':
            for p in record['patterns']:
                if seg_key(p['incoming'])!=seg_key(incoming):continue
                matched=any(seg_key(t)==seg_key(outgoing) for t in p['targets'])
                if (p['action']=='no' and matched) or (p['action']=='only' and not matched):
                    blocked.append(record['relation_id'])
        elif record['status'] in {'unresolved','invalid'}:
            if any(seg_key(s)==seg_key(incoming) for s in record['incoming_guards']):pending.append(record['relation_id'])
            elif not record['incoming_guards']:unlocated.append(record['relation_id'])
    state='forbidden' if blocked else 'unresolved' if pending else 'not_blocked_by_evaluated_rules'
    return {'state':state,'blocking_relations':sorted(set(blocked)),
            'pending_local_relations':sorted(set(pending)),
            'unlocated_pending_relations':sorted(set(unlocated)),
            'coverage_complete':not pending and not unlocated,
            'note':'Không thay cho kiểm tra access, chiều, barrier, kích thước hoặc ngập'}


def audit(snapshot,output,rules_path=RULES_PATH):
    rules,rules_hash=load_rules(rules_path)
    meta=json.loads((snapshot/'metadata.json').read_text(encoding='utf-8'))
    if meta.get('status')!='completed':raise ValueError('Snapshot chưa hoàn tất')
    raw_bytes=(snapshot/'osm-raw.json').read_bytes();raw=json.loads(raw_bytes)
    raw_hash=hashlib.sha256(raw_bytes).hexdigest()
    if meta.get('raw_sha256') and meta['raw_sha256']!=raw_hash:raise ValueError('Hash OSM gốc khác metadata; cần kiểm tra snapshot')
    elements={(e['type'],e['id']):e for e in raw['elements']}
    relations=sorted((e for e in elements.values() if e['type']=='relation' and e.get('tags',{}).get('type')=='restriction'),key=lambda e:e['id'])
    records=mark_only_conflicts([normalize(r,p,elements,rules) for r in relations for p in rules['profile_keys']])
    counts=Counter((r['profile'],r['status']) for r in records)
    summary=[{'profile':p,'status':s,'relation_count':counts[p,s],'denominator':len(relations)}
             for p in rules['profile_keys'] for s in ['ready','exempt','not_applicable','unresolved','invalid']]
    output.mkdir(parents=True,exist_ok=True)
    run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
    (run/'turn-rules.normalized.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    rows=[{k:r[k] for k in ['relation_id','profile','status','rule_key','rule_value','reason']}|
          {'except_tokens':';'.join(r['except_tokens']),'incoming_pattern_count':len(r['patterns']),
           'osm_url':f"https://www.openstreetmap.org/relation/{r['relation_id']}"} for r in records]
    csv_write(run/'turn-relations.csv',['relation_id','profile','status','rule_key','rule_value','reason','except_tokens','incoming_pattern_count','osm_url'],rows)
    csv_write(run/'turn-summary.csv',['profile','status','relation_count','denominator'],summary)
    (run/'rules-used.json').write_bytes(Path(rules_path).read_bytes())
    metadata={'dataset_version':meta['dataset_version'],'rules_version':rules['version'],'rules_sha256':rules_hash,
              'osm_raw_sha256':raw_hash,'created_at':datetime.now(timezone.utc).isoformat(),
              'relation_count':len(relations),'profile_decision_count':len(records),
              'scope':'all restriction relations in snapshot, including download buffer and dependencies; not study-only',
              'segment_identity':'(way_id,segment_index,direction,from_node,to_node), raw adjacent nodes, not final graph edges',
              'not_evaluated':['time conditions','via-way path restrictions','access/direction reachability','barriers','dimensions','speed','flood'],
              'graph_created':False}
    (run/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    return run,summary


def main(argv=None):
    parser=argparse.ArgumentParser(description='Chuẩn hóa cấm rẽ, chưa tạo graph')
    parser.add_argument('--snapshot',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('data/routing-turn'))
    parser.add_argument('--rules',type=Path,default=RULES_PATH)
    args=parser.parse_args(argv)
    try:
        run,summary=audit(args.snapshot,args.output,args.rules)
        print('Kết quả:',run.resolve())
        for r in summary:print(r['profile'],r['status'],r['relation_count'])
        print('ready = đã chuẩn hóa, chưa áp dụng vào graph. Điều kiện/via-way chưa xử lý không được bỏ qua khi định tuyến.')
        return 0
    except (OSError,ValueError,KeyError,TypeError) as exc:
        print('LỖI:',exc,file=sys.stderr);return 1


if __name__=='__main__':sys.exit(main())
