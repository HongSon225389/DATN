#!/usr/bin/env python3
"""Normalize unique ordered via-way paths; bounded history transition checks."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import turn_rules as tr
import time_turn_rules as tt
from access_rules import csv_write

VERSION='hanoi-via-way-0.1.0'


def normalize(rel, profile, elements, rules):
    r=tr.normalize(rel,profile,elements,rules)
    r.update(sequence_patterns=[],via_rules_version=VERSION)
    if r['reason']!='via-way/chuỗi via chưa hỗ trợ; cần trạng thái nhớ chuỗi cạnh':return r
    def finish(status,reason):
        r.update(status=status,reason=reason);return r
    via=[m for m in rel['members'] if m['role']=='via']
    if any(m['type']!='way' for m in via):return finish('unresolved','Trộn via-node/via-way hoặc nhiều via-node chưa hỗ trợ')
    from_m=next(m for m in rel['members'] if m['role']=='from')
    to_m=next(m for m in rel['members'] if m['role']=='to')
    ways=[elements['way',m['ref']] for m in [from_m,*via,to_m]]
    # The input via member order is preserved, never silently reordered.
    ids=[w['id'] for w in ways]
    if len(set(ids[1:-1]))!=len(ids[1:-1]) or set(ids[1:-1]) & {ids[0],ids[-1]}:
        return finish('unresolved','Way lặp trong chuỗi via chưa hỗ trợ')
    for w in ways:
        ns=w.get('nodes',[])
        if len(ns)<2 or any(('node',n) not in elements for n in ns):return finish('invalid','Thiếu node hoặc way không có đủ hình học')
        if len(set(ns))!=len(ns):return finish('unresolved','Way vòng/lặp node; chưa xác định chuỗi duy nhất')
    # Conservative: adjacent ways must share exactly one node and connect at endpoints.
    joins=[]
    for a,b in zip(ways,ways[1:]):
        common=set(a['nodes']) & set(b['nodes'])
        if not common:return finish('invalid','Chuỗi via theo thứ tự nguồn không liên thông')
        if len(common)!=1:return finish('unresolved','Hai way kề nhau có nhiều nút chung; không tự đoán đường đi')
        node=next(iter(common))
        if node not in [a['nodes'][0],a['nodes'][-1]] or node not in [b['nodes'][0],b['nodes'][-1]]:
            return finish('unresolved','Điểm nối nằm giữa way; cần tách/rà soát topology')
        joins.append(node)
    r['incoming_guards']=tr.incoming_segments(ways[0],joins[0])
    chain=tr.incoming_segments(ways[0],joins[0])
    for i,w in enumerate(ways[1:-1]):
        ns=w['nodes'];entry,exit=joins[i:i+2]
        if entry==exit:return finish('unresolved','Via vào và ra cùng nút; chuỗi chưa duy nhất')
        direction='forward' if ns[0]==entry else 'backward'
        indexes=range(len(ns)-1) if direction=='forward' else range(len(ns)-2,-1,-1)
        chain += [tr.segment(w['id'],index,direction,ns) for index in indexes]
    chain += tr.outgoing_segments(ways[-1],joins[-1])
    if any(a['to_node']!=b['from_node'] for a,b in zip(chain,chain[1:])):
        return finish('invalid','Chuỗi đoạn không liên tục')
    r['sequence_patterns']=[{'segments':chain,'action':'only' if r['rule_value'].startswith('only_') else 'no'}]
    r['via_way_ids']=ids[1:-1]
    return finish('ready','Đã chuẩn hóa chuỗi via-way duy nhất theo thứ tự nguồn; chưa áp dụng graph')


def evaluate_at(relations,elements,rules,at):
    records=[tt.normalize_at(r,p,elements,rules,at,normalizer=normalize) for r in relations for p in rules['profile_keys']]
    return tr.mark_only_conflicts(records)


class RestrictionMachine:
    """History must be carried in the search state, not reset at junctions."""
    def __init__(self,records,profile):
        if profile not in {'car','motorcycle','walking'}:raise ValueError('Phương tiện không hợp lệ')
        self.records=[r for r in records if r['profile']==profile]
        times={r.get('evaluated_at') for r in self.records if r.get('evaluated_at')}
        if len(times)>1:raise ValueError('Không trộn kết quả từ nhiều thời điểm')
        self.evaluated_at=next(iter(times),None)
        self.limit=max([1]+[len(p['segments'])-1 for r in self.records if r['status']=='ready' for p in r.get('sequence_patterns',[])])
    def advance(self,history,outgoing):
        history=list(history)
        if any(a['to_node']!=b['from_node'] for a,b in zip(history,history[1:])):
            raise ValueError('Lịch sử không liên thông')
        if history:
            base=tr.evaluate_transition(self.records,self.records[0]['profile'] if self.records else 'car',history[-1],outgoing)
        else:
            base={'state':'not_blocked_by_evaluated_rules','blocking_relations':[], 'pending_local_relations':[],
                  'unlocated_pending_relations':[r['relation_id'] for r in self.records if r['status'] in {'invalid','unresolved'} and not r['incoming_guards']],
                  'coverage_complete':True}
        if base['state']=='invalid_transition':return {**base,'next_history':history,'evaluated_at':self.evaluated_at}
        blocked=set(base['blocking_relations'])
        keys=[tr.seg_key(s) for s in history];new=tr.seg_key(outgoing)
        for r in self.records:
            if r['status']!='ready':continue
            for p in r.get('sequence_patterns',[]):
                target=[tr.seg_key(s) for s in p['segments']]
                if p['action']=='no':
                    if len(keys)>=len(target)-1 and keys[-(len(target)-1):]+[new]==target:blocked.add(r['relation_id'])
                else:
                    for n in range(1,min(len(keys),len(target)-1)+1):
                        if keys[-n:]==target[:n] and new!=target[n]:blocked.add(r['relation_id'])
        base['blocking_relations']=sorted(blocked)
        if blocked:base['state']='forbidden'
        base['coverage_complete']=not base['pending_local_relations'] and not base['unlocated_pending_relations']
        base['next_history']=(history+[outgoing])[-self.limit:] if base['state']=='not_blocked_by_evaluated_rules' else history[-self.limit:]
        base['evaluated_at']=self.evaluated_at
        base['note']='Chỉ kiểm tra restriction tại thời điểm đóng băng; phải kết hợp access/chiều/barrier/ngập và chính sách pending'
        return base


def audit(snapshot,output,at):
    at=tt.instant(at);rules,rules_hash=tr.load_rules()
    meta=json.loads((snapshot/'metadata.json').read_text(encoding='utf-8'))
    raw=(snapshot/'osm-raw.json').read_bytes();digest=hashlib.sha256(raw).hexdigest()
    if meta.get('status')!='completed' or (meta.get('raw_sha256') and meta['raw_sha256']!=digest):raise ValueError('Snapshot/hash không hợp lệ')
    elements={(e['type'],e['id']):e for e in json.loads(raw)['elements']}
    rels=sorted((r for r in elements.values() if r['type']=='relation' and r.get('tags',{}).get('type')=='restriction'),key=lambda r:r['id'])
    records=evaluate_at(rels,elements,rules,at)
    rows=[{'profile':p,'status':s,'count':n} for (p,s),n in sorted(Counter((r['profile'],r['status']) for r in records).items())]
    output.mkdir(parents=True,exist_ok=True);run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
    (run/'turn-rules.with-sequences.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    csv_write(run/'summary.csv',['profile','status','count'],rows)
    fields=['relation_id','profile','status','time_state','sequence_count','sequence_segment_count','reason']
    csv_write(run/'decisions.csv',fields,[{**{k:r.get(k,'') for k in fields},'sequence_count':len(r.get('sequence_patterns',[])), 'sequence_segment_count':sum(len(p['segments']) for p in r.get('sequence_patterns',[]))} for r in records])
    (run/'metadata.json').write_text(json.dumps(dict(version=VERSION,time_rules_version=tt.VERSION,base_rules_version=rules['version'],base_rules_sha256=rules_hash,dataset_version=meta['dataset_version'],osm_raw_sha256=digest,evaluated_at=at.isoformat(),scope='all snapshot relations including buffer/dependencies',relation_count=len(rels),profile_decision_count=len(records),graph_created=False,applied_to_graph=False,via_order='source member order; unique endpoint connections only',search_state_requirement='node + bounded directed segment history; node-only Dijkstra is incorrect',not_evaluated=['access/direction','barriers','speed','flood','arrival time','unresolved relation coverage policy']),ensure_ascii=False,indent=2),encoding='utf-8')
    (run/'rules-used.json').write_bytes(tr.RULES_PATH.read_bytes())
    return run,rows,records


def main():
    p=argparse.ArgumentParser(description='Chuẩn hóa via-way và kiểm tra chuỗi, chưa tạo graph')
    p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--at',required=True)
    p.add_argument('--output',type=Path,default=Path('data/routing-via-way'))
    a=p.parse_args()
    try:
        run,rows,rs=audit(a.snapshot,a.output,a.at);print('Kết quả:',run.resolve())
        for row in rows:print(row['profile'],row['status'],row['count'])
        for profile in ['car','motorcycle','walking']:
            print(profile,'ready via-way',sum(r['status']=='ready' and bool(r.get('sequence_patterns')) for r in rs if r['profile']==profile))
        print('Chưa tạo graph. Khi tìm đường phải giữ lịch sử chuỗi và kết hợp quyền đi/chiều/ngập.')
        return 0
    except (OSError,ValueError,KeyError,TypeError) as e:print('LỖI:',e,file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
