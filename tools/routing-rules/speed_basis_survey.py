#!/usr/bin/env python3
"""Survey speed evidence without inferring missing signs or legal defaults."""
import argparse
from collections import Counter
from datetime import date, datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
from urllib.parse import urlparse
import barrier_speed_rules as bs
import time_turn_rules as tt
from access_rules import csv_write

VERSION='hanoi-speed-basis-0.1.0'
ATTRS=['maxspeed','maxspeed:forward','maxspeed:backward','maxspeed:motorcar','maxspeed:motorcycle','maxspeed:foot','maxspeed:conditional','maxspeed:type','source:maxspeed','lanes','lanes:forward','lanes:backward','lanes:psv','oneway','divider','dual_carriageway','urban','zone:traffic','zone:maxspeed','lit']


def template(dataset,way_id,case):
    return dict(dataset_version=dataset,way_id=way_id,profile='car',direction='forward',case=case,
                sign_status='unknown',built_up_status='unknown',road_layout='unknown',motor_lanes=None,
                vehicle_class='passenger_car',proposed_limit_kmh=None,basis_kind='unknown',
                source_url='',source_title='',source_date='',checked_at='',reviewer='',review_status='draft',
                applies_to_whole_way=False,valid_from='',valid_until='',condition='',notes='',applied_to_routing=False)


def validate_evidence(bundle,dataset,way_ids):
    if bundle.get('dataset_version')!=dataset:raise ValueError('Phiếu khác phiên bản snapshot')
    records=bundle.get('records')
    if not isinstance(records,list):raise ValueError('records phải là danh sách')
    result={}
    for r in records:
        if not isinstance(r,dict) or r.get('dataset_version')!=dataset:raise ValueError('Phiếu thiếu/sai phiên bản')
        wid=r.get('way_id');profile=r.get('profile');direction=r.get('direction')
        if isinstance(wid,bool) or not isinstance(wid,int) or wid not in way_ids:raise ValueError('way_id không nằm trong phạm vi khảo sát')
        if profile not in bs.PROFILES or direction not in {'forward','backward'}:raise ValueError('Hồ sơ/chiều không hợp lệ')
        key=(wid,profile,direction)
        if key in result:raise ValueError('Trùng phiếu cho cùng way/hồ sơ/chiều; cần gộp lịch sử thủ công')
        if r.get('sign_status') not in {'unknown','present','confirmed_absent'}:raise ValueError('sign_status không hợp lệ')
        if r.get('built_up_status') not in {'unknown','inside','outside'}:raise ValueError('built_up_status không hợp lệ')
        if r.get('road_layout') not in {'unknown','divided','undivided_two_way','one_way'}:raise ValueError('road_layout không hợp lệ')
        if r.get('basis_kind') not in {'unknown','osm_comparison','sign_document','general_rule'}:raise ValueError('basis_kind không hợp lệ')
        if r.get('review_status') not in {'draft','reviewed'}:raise ValueError('review_status không hợp lệ')
        n=r.get('proposed_limit_kmh')
        if n is not None and (isinstance(n,bool) or not isinstance(n,(int,float)) or not math.isfinite(n) or n<=0):raise ValueError('Giới hạn đề xuất không hợp lệ')
        lanes=r.get('motor_lanes')
        if lanes is not None and (isinstance(lanes,bool) or not isinstance(lanes,int) or lanes<1):raise ValueError('Số làn xe cơ giới không hợp lệ')
        if r.get('applied_to_routing') is not False:raise ValueError('Giai đoạn này không cho tự áp dụng phiếu vào router')
        if not isinstance(r.get('applies_to_whole_way'),bool):raise ValueError('applies_to_whole_way phải là boolean')
        if r.get('source_date'):
            if len(r['source_date'])==10:date.fromisoformat(r['source_date'])
            else:tt.instant(r['source_date'])
        for k in ['checked_at','valid_from','valid_until']:
            if r.get(k):tt.instant(r[k])
        if r.get('valid_from') and r.get('valid_until') and tt.instant(r['valid_from'])>=tt.instant(r['valid_until']):raise ValueError('Khoảng hiệu lực không hợp lệ')
        if r.get('review_status')=='reviewed':
            parsed=urlparse(r.get('source_url',''))
            if parsed.scheme not in {'https','http'} or not parsed.netloc:raise ValueError('Phiếu reviewed cần URL nguồn')
            if not r.get('reviewer') or not r.get('checked_at') or not r.get('notes'):raise ValueError('Phiếu reviewed cần người, giờ kiểm tra và nhận xét')
        # This is schema checking, not a statement that the URL proves the claim.
        result[key]=r
    return result


def evidence_flags(r,at,osm_limit):
    flags=[]
    if r.get('review_status')!='reviewed':flags.append('draft_not_reviewed')
    if not r.get('applies_to_whole_way'):flags.append('whole_way_scope_not_confirmed')
    if r.get('condition'):flags.append('manual_condition_not_evaluated')
    if r.get('basis_kind')=='general_rule':
        if r.get('sign_status')!='confirmed_absent':flags.append('absence_of_applicable_special_limit_not_established')
        if r.get('built_up_status')=='unknown' or r.get('road_layout')=='unknown':flags.append('general_rule_context_incomplete')
        if r.get('road_layout')=='one_way' and not r.get('motor_lanes'):flags.append('motor_lanes_missing')
        if not r.get('vehicle_class'):flags.append('vehicle_class_missing')
    if r.get('basis_kind')=='sign_document' and r.get('sign_status')!='present':flags.append('sign_document_presence_not_confirmed')
    if r.get('basis_kind') in {'unknown','osm_comparison'}:flags.append('no_independent_limit_basis')
    if r.get('proposed_limit_kmh') is None:flags.append('no_proposed_limit')
    if r.get('valid_from') and at<tt.instant(r['valid_from']):flags.append('not_yet_effective')
    if r.get('valid_until') and at>=tt.instant(r['valid_until']):flags.append('expired')
    if osm_limit is not None and r.get('proposed_limit_kmh') is not None and not math.isclose(osm_limit,r['proposed_limit_kmh']):flags.append('conflicts_with_osm_limit')
    return flags


def audit(snapshot,output,at,evidence_path=None):
    at=tt.instant(at);config,cfg_hash=bs.load_config()
    meta=json.loads((snapshot/'metadata.json').read_text(encoding='utf-8'));raw=(snapshot/'osm-raw.json').read_bytes()
    digest=hashlib.sha256(raw).hexdigest()
    if meta.get('status')!='completed' or (meta.get('raw_sha256') and meta['raw_sha256']!=digest):raise ValueError('Snapshot/hash không hợp lệ')
    elements={(e['type'],e['id']):e for e in json.loads(raw)['elements']}
    geo=(snapshot/'roads.geojson').read_bytes();features=json.loads(geo)['features']
    ids={f['properties']['osm_way_id'] for f in features if f['properties'].get('scope')=='study_intersection' and f.get('geometry',{}).get('type')=='LineString' and f['properties']['osm_tags'].get('area')!='yes'}
    ways={wid:elements['way',wid] for wid in sorted(ids)}
    for f in features:
        p=f['properties']
        if p.get('osm_way_id') in ids and p.get('scope')=='study_intersection' and p['osm_tags']!=ways[p['osm_way_id']].get('tags',{}):raise ValueError('Tags GeoJSON khác raw OSM')
    ev_raw=Path(evidence_path).read_bytes() if evidence_path else None
    evidence=validate_evidence(json.loads(ev_raw),meta['dataset_version'],ids) if ev_raw else {}
    rows=[];counts=Counter();survey=[]
    samples={k:[] for k in ['osm_numeric','missing_limit','directional','conditional']}
    for wid,way in ways.items():
        tags=way.get('tags',{})
        survey.append({'way_id':wid,'name':tags.get('name',''),'highway':tags.get('highway',''),**{k:tags.get(k,'') for k in ATTRS},'osm_tags_json':json.dumps(tags,ensure_ascii=False),'osm_url':f'https://www.openstreetmap.org/way/{wid}'})
        for k in ATTRS:
            if k in tags:counts['way_tag',k]+=1
        cats=[]
        if 'maxspeed' in tags:
            try:bs.number(tags['maxspeed'],'km/h|mph');cats.append('osm_numeric')
            except ValueError:pass
        if not any(k=='maxspeed' or k.startswith('maxspeed:') for k in tags):cats.append('missing_limit')
        if any(k.startswith('maxspeed') and (':forward' in k or ':backward' in k) for k in tags):cats.append('directional')
        if any(k.startswith('maxspeed') and ':conditional' in k for k in tags):cats.append('conditional')
        for cat in cats:
            counts['sample_candidate',cat]+=1
            if len(samples[cat])<3:samples[cat].append(template(meta['dataset_version'],wid,cat))
        for p in bs.PROFILES:
            for direction in ['forward','backward']:
                speed=bs.speed(tags,p,direction,config,at)
                state='osm_reported_unverified' if speed['limit_status']=='parsed' else 'unknown_missing' if speed['limit_status']=='missing' else 'unknown_unsupported'
                counts[p,state]+=1
                ev=evidence.get((wid,p,direction))
                flags=evidence_flags(ev,at,speed['limit_kmh']) if ev else []
                rows.append(dict(way_id=wid,profile=p,direction=direction,osm_limit_kmh=speed['limit_kmh'],osm_limit_key=speed['limit_key'],osm_raw_limit=speed['raw_limit'],osm_source_url=f'https://www.openstreetmap.org/way/{wid}',limit_basis_state=state,
                                 assumed_free_speed_kmh=speed['estimated_free_kmh'],estimated_speed_kmh=speed['effective_kmh'],estimate_state=speed['state'],estimate_source=config['version'],
                                 sign_presence='unknown' if not ev else ev['sign_status'],review_status=ev['review_status'] if ev else 'not_reviewed',
                                 proposed_limit_kmh=ev.get('proposed_limit_kmh') if ev else None,source_url=ev.get('source_url','') if ev else '',
                                 evidence_flags=';'.join(flags),manual_limit_applied=False,verified_legal_limit_kmh=None,
                                 note='Missing OSM is not absence of a sign; estimates are research assumptions; manual entries do not override limits'))
    on_nodes={n for way in ways.values() for n in way.get('nodes',[])}
    sign_nodes=[e for e in elements.values() if e['type']=='node' and ('maxspeed' in e.get('tags',{}) or 'maxspeed' in e.get('tags',{}).get('traffic_sign','').lower())]
    summary=[{'scope':'study_way','metric':key,'count':counts['way_tag',key],'denominator':len(ways)} for key in ATTRS]
    summary += [{'scope':'profile_direction','metric':p+':'+state,'count':counts[p,state],'denominator':len(ways)*2} for p in bs.PROFILES for state in ['osm_reported_unverified','unknown_missing','unknown_unsupported']]
    summary += [{'scope':'sample_category','metric':cat,'count':counts['sample_candidate',cat],'denominator':len(ways)} for cat in samples]
    summary += [{'scope':'raw_nodes','metric':'speed_sign_or_limit_hint','count':len(sign_nodes),'denominator':''},{'scope':'study_way_nodes','metric':'speed_sign_or_limit_hint','count':sum(e['id'] in on_nodes for e in sign_nodes),'denominator':''}]
    # One editable draft per way/profile/direction, preserving all sample labels.
    drafts={}
    for cat,rs in samples.items():
        for r in rs:
            key=(r['way_id'],r['profile'],r['direction'])
            if key in drafts:drafts[key]['case']+=';'+cat
            else:drafts[key]=r
    output.mkdir(parents=True,exist_ok=True);run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
    csv_write(run/'speed-context.csv',list(survey[0]) if survey else ['way_id'],survey)
    csv_write(run/'speed-basis.csv',list(rows[0]) if rows else ['way_id'],rows)
    csv_write(run/'summary.csv',['scope','metric','count','denominator'],summary)
    (run/'review-template.json').write_text(json.dumps({'dataset_version':meta['dataset_version'],'records':list(drafts.values())},ensure_ascii=False,indent=2),encoding='utf-8')
    (run/'speed-node-hints.json').write_text(json.dumps(sign_nodes,ensure_ascii=False,indent=2),encoding='utf-8')
    if ev_raw:(run/'evidence-used.json').write_bytes(ev_raw)
    (run/'metadata.json').write_text(json.dumps(dict(version=VERSION,dataset_version=meta['dataset_version'],osm_raw_sha256=digest,roads_sha256=hashlib.sha256(geo).hexdigest(),estimate_rules_sha256=cfg_hash,evidence_sha256=hashlib.sha256(ev_raw).hexdigest() if ev_raw else None,evaluated_at=at.isoformat(),study_linear_ways=len(ways),profile_direction_count=len(rows),input_evidence_count=len(evidence),reviewed_input_count=sum(r.get('review_status')=='reviewed' for r in evidence.values()),sample_method='up to 3 lowest way IDs per category; overlapping categories, not representative',no_legal_default_inference=True,no_manual_limit_applied=True,graph_created=False),ensure_ascii=False,indent=2),encoding='utf-8')
    return run,summary


def main():
    p=argparse.ArgumentParser(description='Khảo sát căn cứ tốc độ và ghi nguồn; không tự suy giới hạn luật')
    p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--at',required=True);p.add_argument('--evidence',type=Path);p.add_argument('--output',type=Path,default=Path('data/routing-speed-basis'))
    a=p.parse_args()
    try:
        run,rows=audit(a.snapshot,a.output,a.at,a.evidence);print('Kết quả:',run.resolve())
        for row in rows:print(row['scope'],row['metric'],row['count'],'/',row['denominator'])
        print('Chưa suy giới hạn 50/60; nguồn OSM chưa xác minh độc lập; phiếu đối chiếu chưa áp dụng định tuyến.')
        return 0
    except (ValueError,OSError,KeyError,TypeError) as e:print('LỖI:',e,file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
