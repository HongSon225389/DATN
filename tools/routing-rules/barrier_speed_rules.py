#!/usr/bin/env python3
"""Auditable node barriers and estimated speed; no graph or route permission."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import access_rules as ar
import time_turn_rules as tt

CONFIG=Path(__file__).with_name('barrier-speed-rules.v1.json')
PROFILES=['car','motorcycle','walking']
ACCESS={'car':['motorcar','motor_vehicle','vehicle','access'],'motorcycle':['motorcycle','motor_vehicle','vehicle','access'],'walking':['foot','access']}


def load_config(path=CONFIG):
    raw=Path(path).read_bytes();c=json.loads(raw)
    if set(c['vehicles'])!=set(PROFILES):raise ValueError('Thiếu ba phương tiện')
    for vehicle in c['vehicles'].values():
        for value in vehicle.values():
            if value is not None and (isinstance(value,bool) or not isinstance(value,(float,int)) or not math.isfinite(value) or value<=0):raise ValueError('Kích thước xe không hợp lệ')
    for values in c['estimated_kmh'].values():
        if len(values)!=3 or any(v is not None and (isinstance(v,bool) or not isinstance(v,(float,int)) or not math.isfinite(v) or v<=0) for v in values):raise ValueError('Bảng tốc độ không hợp lệ')
    return c,hashlib.sha256(raw).hexdigest()


def number(value,unit):
    match=re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*('+unit+r')?\s*',value)
    if not match:raise ValueError('Đơn vị/giá trị chưa hỗ trợ')
    n=float(match[1])
    if not math.isfinite(n) or n<=0:raise ValueError('Giá trị phải hữu hạn và dương')
    return n,match[2]


def mass_tonnes(value):
    """OSM default metric tonnes; explicit units normalized to tonnes."""
    n,unit=number(value,r't|kg|lbs|lb|st')
    return n*{'kg':0.001,'lbs':0.00045359237,'lb':0.00045359237,'st':0.90718474}.get(unit,1)


def dimensions(tags,profile,config):
    vehicle=config['vehicles'][profile];checks=[];unknown=[];blocked=[]
    for key,dim in [('maxwidth','width_m'),('maxwidth:physical','width_m'),('maxheight','height_m'),('maxheight:physical','height_m')]:
        if key not in tags:continue
        try:
            limit,_=number(tags[key],'m');size=vehicle[dim]
            checks.append({'key':key,'raw':tags[key],'limit_m':limit,'vehicle_m':size})
            if size is None:unknown.append(key+': thiếu kích thước cấu hình')
            elif size>=limit:blocked.append(key) # conservative equality requires review/clearance
        except ValueError:unknown.append(key+': không đọc được kích thước')
    if profile!='walking':
        for key,field in [('maxweight','actual_weight_t'),('maxaxleload','max_axle_load_t'),('maxweightrating','gross_weight_rating_t')]:
            if key not in tags:continue
            try:
                limit=mass_tonnes(tags[key]);size=vehicle.get(field);basis=field
                # Any single axle cannot carry more than the vehicle's total mass.
                # This bound proves passage only; exceeding it does not prove an axle violation.
                if key=='maxaxleload' and size is None:
                    total=vehicle.get('actual_weight_t')
                    if total is not None and total<=limit:size=total;basis='actual_weight_upper_bound'
                checks.append({'key':key,'raw':tags[key],'limit_t':limit,'vehicle_t':size,'basis':basis})
                if size is None:unknown.append(key+': thiếu khối lượng cấu hình')
                elif size>limit:blocked.append(key)
            except ValueError:unknown.append(key+': không đọc được tải trọng')
    for key in tags:
        # These are sign-presence metadata, not numeric load limits.
        if key in {'maxweight:signed','maxaxleload:signed','maxweightrating:signed'} and tags[key] in {'yes','no'}:continue
        # These profiles represent a passenger car / motorcycle, never HGVs.
        if key.startswith(('maxweight:','maxweightrating:','maxaxleload:')) and key.split(':')[1] in {'hgv','hgv_articulated'}:continue
        if any(key.startswith(k+':') for k in ['maxwidth','maxheight']) and key not in {'maxwidth:physical','maxheight:physical'}:unknown.append(key)
        if profile!='walking' and (key.startswith('maxweight') or key.startswith('maxaxleload') or key.startswith('maxlength')) and key not in {'maxweight','maxaxleload','maxweightrating'}:unknown.append(key)
    return {'state':'forbidden' if blocked else 'unresolved' if unknown else 'not_blocked_by_known_dimensions', 'blocked_by':blocked,'pending':unknown,'checks':checks,'vehicle_assumed':vehicle}


def barrier(tags,profile,config):
    if profile not in PROFILES:raise ValueError('Phương tiện không hợp lệ')
    kind=tags.get('barrier','');keys=ACCESS[profile];dim=dimensions(tags,profile,config)
    key=next((k for k in keys if k in tags),None);value=tags.get(key,'').strip()
    pending=[k for k in tags if any(k.startswith(a+':') for a in keys)]
    state='unresolved';reason='Loại rào chắn hoặc quyền qua chưa rõ'
    permission='allowed' if value in {'yes','permissive','designated','official','discouraged'} else 'forbidden' if value in {'no','use_sidepath'} else 'restricted' if value in {'private','destination','customers','delivery','permit','agricultural','forestry','emergency'} else 'unresolved'
    if key=='access' and value in {'designated','official'}:permission='unresolved'
    if not kind:state='not_a_barrier';reason='Không có barrier'
    elif permission=='forbidden':state='forbidden';reason='Tag quyền đi từ chối phương tiện'
    elif kind in {'wall','fence','block','jersey_barrier'}:state='forbidden';reason='Vật cản cố định trong mô hình; không tự mở theo access=yes'
    elif dim['state']=='forbidden':state='forbidden';reason='Kích thước cấu hình không nhỏ hơn giới hạn'
    elif pending or any(k in tags for k in ['opening_hours','locked:conditional','open:conditional']):reason='Điều kiện quyền/cổng chưa được diễn giải'
    elif dim['state']=='unresolved':reason='Giới hạn kích thước chưa xử lý đầy đủ'
    elif permission=='restricted':state='restricted';reason='Quyền theo mục đích/đối tượng; không dùng đi xuyên công cộng'
    elif key and permission=='unresolved':reason='Giá trị quyền cụ thể chưa hỗ trợ; không hạ xuống quyền chung'
    elif tags.get('locked')=='yes':state='unresolved';reason='Có khóa; không biết quyền chìa khóa/lối phụ theo phương tiện'
    elif tags.get('locked') not in {None,'no'} or tags.get('open') not in {None,'yes','no'}:reason='Trạng thái cổng bất thường/chưa rõ'
    elif kind in {'gate','lift_gate','swing_gate','sliding_gate'}:
        if permission=='allowed' and (tags.get('open')=='yes' or tags.get('locked')=='no'):
            state='allowed_by_model';reason='Có quyền và cổng mở hoặc không khóa theo tag; giả định có thể thao tác mở'
        else:reason='Cổng thiếu quyền rõ ràng hoặc thiếu trạng thái mở/khóa'
    elif kind=='bollard':
        if profile=='car':state='forbidden';reason='Không hỗ trợ ô tô qua cọc chắn; cọc tháo được cần rà soát riêng'
        elif profile=='walking':state='allowed_by_model';reason='Giả định người đi bộ qua cọc chắn; chưa đo khe hở'
        else:reason='Không suy xe máy qua được từ loại cọc hoặc access=yes'
    elif kind in {'entrance','height_restrictor'}:
        if permission=='allowed':state='allowed_by_model';reason='Quyền rõ ràng; không bị giới hạn kích thước đã biết chặn'
        else:reason='Chưa có quyền qua rõ ràng'
    return {'profile':profile,'barrier':kind,'state':state,'reason':reason,'access_key':key or '', 'access_value':value,'dimensions':dim,'tags':tags,'warning':'Chỉ quy tắc mô hình; không xác minh hiện trường, không mở quyền way; thiếu giới hạn không chứng minh đủ khoảng hở'}


def speed(tags,profile,direction,config,at=None):
    if profile not in PROFILES or direction not in {'forward','backward'}:raise ValueError('Phương tiện/chiều không hợp lệ')
    stems={'car':['maxspeed:motorcar','maxspeed:motor_vehicle','maxspeed:vehicle','maxspeed'],'motorcycle':['maxspeed:motorcycle','maxspeed:motor_vehicle','maxspeed:vehicle','maxspeed'],'walking':['maxspeed:foot']}[profile]
    keys=[k for stem in stems for k in [stem+':'+direction,stem]]
    chosen=next((k for k in keys if k in tags or k+':conditional' in tags),None)
    relevant=set(keys)
    pending=[]
    for key in tags:
        for stem in stems:
            if key==stem+':lanes' or key.startswith(stem+':lanes:') or key==stem+':'+direction+':lanes' or key.startswith(stem+':variable'):pending.append(key)
    estimate=config['estimated_kmh'].get(tags.get('highway',''),[None,None,None])[PROFILES.index(profile)]
    result={'profile':profile,'direction':direction,'state':'unresolved','limit_status':'missing','limit_kmh':None,'limit_key':chosen or '', 'raw_limit':tags.get(chosen,'') if chosen else '', 'estimated_free_kmh':estimate,'effective_kmh':None,'reason':'','evaluated_at':tt.instant(at).isoformat() if at else '', 'assumed_estimate':True,'not_live_traffic':True}
    try:
        if pending:raise ValueError('Tốc độ theo làn/biến đổi chưa hỗ trợ: '+','.join(sorted(set(pending))))
        value=tags.get(chosen) if chosen else None
        condition_keys=[k for k in keys if k+':conditional' in tags]
        if condition_keys:
            if len(condition_keys)!=1 or condition_keys[0]!=chosen:raise ValueError('Nhiều tầng điều kiện tốc độ chưa hỗ trợ')
            if at is None:raise ValueError('Tốc độ theo điều kiện cần --at')
            expr=tags[chosen+':conditional']
            m=re.fullmatch(r'\s*([^@;()]+?)\s*@\s*(?:\(([^()]*)\)|([^()]*))\s*',expr)
            if not m:raise ValueError('Biểu thức tốc độ có điều kiện chưa hỗ trợ')
            # Validate numerical value even outside the condition.
            number(m[1].strip(),'km/h|mph')
            if tt.schedule(m[2] if m[2] is not None else m[3],at):value=m[1].strip()
        if value is not None:
            n,unit=number(value,'km/h|mph');limit=n*1.609344 if unit=='mph' else n
            result.update(limit_kmh=limit,limit_status='parsed',raw_limit=value)
        if estimate is None:
            result['reason']='Chưa có tốc độ ước tính cho tổ hợp phương tiện/loại đường; không lấy giới hạn làm tốc độ di chuyển'
        else:
            result.update(state='estimated',effective_kmh=min(estimate,result['limit_kmh']) if result['limit_kmh'] is not None else estimate,reason='Tốc độ cơ sở giả định theo loại đường, giới hạn bởi tag đọc được; chưa xét ngập/ùn tắc')
    except ValueError as exc:result.update(limit_status='unresolved',reason=str(exc))
    return result


def base_time_seconds(length_m,speed_result):
    if isinstance(length_m,bool) or not isinstance(length_m,(float,int)) or not math.isfinite(length_m) or length_m<0:raise ValueError('Chiều dài không hợp lệ')
    if speed_result['state']!='estimated' or not speed_result.get('effective_kmh'):raise ValueError('Chưa có tốc độ đủ điều kiện tính thời gian')
    return 3.6*length_m/speed_result['effective_kmh']


def way_length_m(way,elements):
    total=0.0
    nodes=way.get('nodes',[])
    if len(nodes)<2:raise ValueError('Way không đủ node')
    for a,b in zip(nodes,nodes[1:]):
        coords=[]
        for node in [elements.get(('node',a)),elements.get(('node',b))]:
            if not node:raise ValueError('Thiếu node tính chiều dài')
            lat,lon=node.get('lat'),node.get('lon')
            if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)) or not math.isfinite(lat) or not math.isfinite(lon) or not -90<=lat<=90 or not -180<=lon<=180:raise ValueError('Tọa độ node không hợp lệ')
            coords.append((math.radians(lat),math.radians(lon)))
        (lat1,lon1),(lat2,lon2)=coords
        h=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
        total+=2*6371008.8*math.asin(math.sqrt(min(1,max(0,h))))
    return total


def audit(snapshot,output,at,config_path=CONFIG):
    config,cfg_hash=load_config(config_path);at=tt.instant(at)
    meta=json.loads((snapshot/'metadata.json').read_text(encoding='utf-8'));raw=(snapshot/'osm-raw.json').read_bytes();digest=hashlib.sha256(raw).hexdigest()
    if meta.get('status')!='completed' or (meta.get('raw_sha256') and meta['raw_sha256']!=digest):raise ValueError('Snapshot/hash không hợp lệ')
    elements={(e['type'],e['id']):e for e in json.loads(raw)['elements']}
    road_bytes=(snapshot/'roads.geojson').read_bytes()
    if meta.get('roads_sha256') and meta['roads_sha256']!=hashlib.sha256(road_bytes).hexdigest():raise ValueError('Hash roads không hợp lệ')
    fs=json.loads(road_bytes)['features'];ways={f['properties']['osm_way_id'] for f in fs if f['properties'].get('scope')=='study_intersection' and f['geometry']['type']=='LineString' and f['properties']['osm_tags'].get('area')!='yes'}
    nodes=sorted((e for e in elements.values() if e['type']=='node' and e.get('tags',{}).get('barrier')),key=lambda e:e['id'])
    onways={n for wid in ways for n in elements['way',wid].get('nodes',[])}
    barriers=[{'node_id':e['id'],'on_study_way':e['id'] in onways,**barrier(e['tags'],p,config)} for e in nodes for p in PROFILES]
    waydims=[{'way_id':wid,'profile':p,**dimensions(elements['way',wid].get('tags',{}),p,config)} for wid in sorted(ways) for p in PROFILES]
    lengths={wid:way_length_m(elements['way',wid],elements) for wid in ways}
    speeds=[]
    for wid in sorted(ways):
        for p in PROFILES:
            for d in ['forward','backward']:
                record={'way_id':wid,'length_m':lengths[wid],**speed(elements['way',wid].get('tags',{}),p,d,config,at)}
                record['base_time_seconds']=base_time_seconds(lengths[wid],record) if record['state']=='estimated' else ''
                speeds.append(record)
    output.mkdir(parents=True,exist_ok=True);run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
    fields=['node_id','profile','barrier','state','access_key','access_value','on_study_way','reason']
    ar.csv_write(run/'barriers.csv',fields,[{k:r[k] for k in fields} for r in barriers])
    (run/'barriers.normalized.json').write_text(json.dumps(barriers,ensure_ascii=False,indent=2),encoding='utf-8')
    ar.csv_write(run/'way-dimensions.csv',['way_id','profile','state','blocked_by','pending','checks','vehicle_assumed'],[{**r,'vehicle_assumed':json.dumps(r['vehicle_assumed']),'blocked_by':';'.join(r['blocked_by']),'pending':';'.join(r['pending']),'checks':json.dumps(r['checks'],ensure_ascii=False)} for r in waydims])
    fields=['way_id','profile','direction','length_m','base_time_seconds','state','limit_status','limit_key','raw_limit','limit_kmh','estimated_free_kmh','effective_kmh','reason']
    ar.csv_write(run/'speeds.csv',fields,[{k:r[k] for k in fields} for r in speeds])
    summary=[]
    for category,records in [('barrier_all_snapshot',barriers),('barrier_on_study_way',[r for r in barriers if r['on_study_way']]),('speed_study_way_direction',speeds),('dimensions_study_way',waydims)]:
        summary += [{'category':category,'profile':p,'state':s,'count':n} for (p,s),n in sorted(Counter((r['profile'],r['state']) for r in records).items())]
    ar.csv_write(run/'summary.csv',['category','profile','state','count'],summary)
    (run/'rules-used.json').write_bytes(Path(config_path).read_bytes())
    (run/'metadata.json').write_text(json.dumps(dict(dataset_version=meta['dataset_version'],version=config['version'],rules_sha256=cfg_hash,osm_raw_sha256=digest,roads_sha256=hashlib.sha256(road_bytes).hexdigest(),evaluated_at=at.isoformat(),barrier_nodes=len(nodes),barrier_nodes_on_study_way=sum(e['id'] in onways for e in nodes),study_linear_ways=len(ways),barrier_scope='all raw barrier nodes including buffer/dependencies; study membership by node ID, not proximity',speed_scope='study_intersection linear source ways, both source directions regardless of access; not eligible graph edges',graph_created=False,assumptions=config['assumption_notice']),ensure_ascii=False,indent=2),encoding='utf-8')
    return run,summary


def main():
    p=argparse.ArgumentParser(description='Khảo sát quy tắc cổng/rào chắn và tốc độ cơ sở')
    p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--at',required=True);p.add_argument('--output',type=Path,default=Path('data/routing-barrier-speed'));p.add_argument('--rules',type=Path,default=CONFIG)
    a=p.parse_args()
    try:
        run,rows=audit(a.snapshot,a.output,a.at,a.rules);print('Kết quả:',run.resolve())
        for r in rows:print(r['category'],r['profile'],r['state'],r['count'])
        print('Chưa tạo graph. Tốc độ/kích thước xe là giả định nghiên cứu; không xác nhận quyền tuyến hoặc hiện trường.')
        return 0
    except (OSError,ValueError,KeyError,TypeError) as e:print('LỖI:',e,file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
