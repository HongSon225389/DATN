#!/usr/bin/env python3
"""Conservative turn evaluation at ONE instant, not time-dependent routing."""
import argparse
import copy
from collections import Counter
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
import turn_rules as tr
from access_rules import csv_write

VERSION = 'hanoi-turn-time-0.2.0'
VN = timezone(timedelta(hours=7), 'Asia/Ho_Chi_Minh')
DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']


def instant(value):
    dt = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else value
    if not isinstance(dt, datetime) or dt.tzinfo is None or dt.utcoffset() is None:
        raise ValueError('Thời điểm phải có múi giờ, ví dụ 2026-10-29T08:00:00+07:00')
    return dt.astimezone(VN)


def clock(value, end=False):
    h, m = map(int, value.split(':'))
    if h == 24 and m == 0 and end:
        return 1440
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError('Giờ không hợp lệ')
    return h * 60 + m


def _parse_schedule_group(text):
    """Strict subset: [weekday list/range] HH:MM-HH:MM[,HH:MM-HH:MM]."""
    text = text.strip()
    match = re.fullmatch(r'(?:(?P<days>(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s+)?(?P<times>\d{2}:\d{2}\s*-\s*\d{2}:\d{2}(?:\s*,\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2})*)', text)
    if not match:
        raise ValueError('Điều kiện ngoài tập cú pháp hỗ trợ; PH/SH, ngày tháng, off, AND/OR hoặc nhóm ngày không tường minh')
    days = set(range(7))
    if match['days']:
        days = set()
        for item in match['days'].split(','):
            parts = [DAYS.index(x.strip()) for x in item.split('-')]
            if len(parts) == 1:
                days.add(parts[0])
            else:
                a, b = parts
                days.update((a + n) % 7 for n in range((b-a) % 7 + 1))
    spans=[]
    for span in match['times'].split(','):
        a,b=[x.strip() for x in span.split('-')]
        start,end=clock(a),clock(b,end=True)
        if start==end:raise ValueError('Khoảng giờ bằng nhau chưa hỗ trợ; dùng 00:00-24:00')
        spans.append((start,end))
    return days,spans,bool(match['days'])


def schedule(text, at):
    """Single group may cross midnight; multiple ; groups must be disjoint days, no overnight."""
    at=instant(at)
    parts=text.strip().split(';')
    parsed=[_parse_schedule_group(part.strip()) for part in parts]
    if len(parsed)>1:
        seen=set()
        for days,spans,explicit in parsed:
            if not explicit:raise ValueError('Lịch nhiều nhóm phải ghi rõ ngày cho từng nhóm')
            if seen & days:raise ValueError('Các nhóm ngày chồng nhau; chưa hỗ trợ quy tắc ghi đè lịch')
            if any(start>end for start,end in spans):raise ValueError('Qua nửa đêm trong lịch nhiều nhóm chưa hỗ trợ')
            seen.update(days)
    minute=at.hour*60+at.minute+at.second/60+at.microsecond/60000000
    active=False
    for days,spans,_ in parsed:
        for start,end in spans:
            if start<end:active |= at.weekday() in days and start<=minute<end
            else:active |= (at.weekday() in days and minute>=start) or ((at.weekday()-1)%7 in days and minute<end)
    return bool(active)


def conditional(text, at, rules):
    # Parse the entire expression before evaluating; never ignore an unsupported tail.
    m = re.fullmatch(r'\s*([a-z_]+)\s*@\s*(?:\(([^()]*)\)|([^()]*))\s*', text)
    if not m or m[1] not in rules['no_values'] + rules['only_values']:
        raise ValueError('Chỉ hỗ trợ một cặp restriction @ condition chuẩn; không tự sửa tag')
    return m[1], schedule(m[2] if m[2] is not None else m[3], at)


def normalize_at(rel, profile, elements, rules, at, normalizer=tr.normalize):
    at = instant(at)
    original = normalizer(rel, profile, elements, rules)
    original.update(time_rules_version=VERSION, evaluated_at=at.isoformat(), time_zone='Asia/Ho_Chi_Minh', time_state='not_evaluated')
    tags = rel.get('tags', {})
    keys = rules['profile_keys'][profile]
    conditions = [k for k in keys if k + ':conditional' in tags]
    # Preserve exception handling, malformed exceptions and missing profile applicability.
    if not conditions or original['status'] in {'exempt', 'not_applicable'}:
        original['time_state'] = 'not_applicable'
        return original
    if original['reason'] != 'Có restriction theo điều kiện; chưa đánh giá thời gian, không áp dụng tag tĩnh thay thế':
        return original
    try:
        chosen = original['rule_key']
        if len(conditions) != 1 or conditions[0] != chosen:
            raise ValueError('Nhiều tầng điều kiện/ưu tiên phương tiện chưa hỗ trợ')
        value, active = conditional(tags[chosen + ':conditional'], at, rules)
        effective = value if active else tags.get(chosen, '').strip()
        work = copy.deepcopy(rel)
        for key in keys:
            work['tags'].pop(key + ':conditional', None)
        if not effective:
            work['tags'][chosen] = value
            result = normalizer(work, profile, elements, rules)
            if result['status'] == 'ready':
                result.update(status='inactive_at_time', patterns=[], reason='Không có hạn chế đang hiệu lực tại thời điểm đánh giá; không cấp quyền lưu thông')
        else:
            work['tags'][chosen] = effective
            result = normalizer(work, profile, elements, rules)
        result.update(tags=copy.deepcopy(tags), members=copy.deepcopy(rel.get('members', [])),
                      time_rules_version=VERSION, evaluated_at=at.isoformat(), time_zone='Asia/Ho_Chi_Minh',
                      time_state='active' if active else 'outside_window', effective_value=effective,
                      conditional_source=tags[chosen + ':conditional'], applied_to_graph=False)
        return result
    except ValueError as exc:
        original.update(time_state='unsupported', reason=str(exc))
        return original


def evaluate_at(relations, elements, rules, at):
    at = instant(at)
    return tr.mark_only_conflicts([normalize_at(r, p, elements, rules, at) for r in relations for p in rules['profile_keys']])


def audit(snapshot, output, at):
    at = instant(at)
    rules, rules_hash = tr.load_rules()
    meta = json.loads((snapshot/'metadata.json').read_text(encoding='utf-8'))
    raw = (snapshot/'osm-raw.json').read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if meta.get('status') != 'completed' or (meta.get('raw_sha256') and meta['raw_sha256'] != digest):
        raise ValueError('Snapshot chưa hoàn tất hoặc hash không khớp')
    elements = {(e['type'], e['id']): e for e in json.loads(raw)['elements']}
    relations = sorted((e for e in elements.values() if e['type']=='relation' and e.get('tags',{}).get('type')=='restriction'), key=lambda r:r['id'])
    records = evaluate_at(relations, elements, rules, at)
    counts = Counter((r['profile'], r['status']) for r in records)
    rows = [{'profile':p,'status':s,'count':n} for (p,s),n in sorted(counts.items())]
    output.mkdir(parents=True, exist_ok=True)
    run = output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    run.mkdir()
    (run/'turn-rules.at-time.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    csv_write(run/'summary.csv', ['profile','status','count'], rows)
    csv_write(run/'decisions.csv', ['relation_id','profile','status','time_state','effective_value','reason'], [{k:r.get(k,'') for k in ['relation_id','profile','status','time_state','effective_value','reason']} for r in records])
    (run/'rules-used.json').write_bytes(tr.RULES_PATH.read_bytes())
    metadata = dict(version=VERSION,dataset_version=meta['dataset_version'],osm_raw_sha256=digest,base_rules_sha256=rules_hash,
                    evaluated_at=at.isoformat(),time_zone='Asia/Ho_Chi_Minh',scope='all snapshot restriction relations including buffer/dependencies',
                    graph_created=False,time_dependent_routing=False,relation_count=len(relations),profile_decision_count=len(records),
                    limitations=['one evaluation instant, not predicted junction arrival time','PH/SH/calendar dates/overlapping or overnight multi-group schedules/multiple conditional pairs unsupported','via-way/access/direction/barriers/speed/flood not applied'])
    (run/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    return run, rows


def main():
    parser=argparse.ArgumentParser(description='Đánh giá chuyển hướng theo giờ/ngày tại một thời điểm rõ múi giờ')
    parser.add_argument('--snapshot',type=Path,required=True)
    parser.add_argument('--at',required=True)
    parser.add_argument('--output',type=Path,default=Path('data/routing-turn-time'))
    args=parser.parse_args()
    try:
        run,rows=audit(args.snapshot,args.output,args.at)
        print('Kết quả:',run.resolve())
        for row in rows: print(row['profile'],row['status'],row['count'])
        print('Chỉ đánh giá tại --at. Chưa tạo graph; chưa xét thời điểm đến nút rẽ hoặc via-way.')
        return 0
    except (ValueError,OSError,KeyError,TypeError) as exc:
        print('LỖI:',exc,file=sys.stderr); return 1

if __name__=='__main__': sys.exit(main())
