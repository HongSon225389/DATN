#!/usr/bin/env python3
"""Direction+access decisions per OSM way; not graph edges or turn handling."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

import access_rules as access

RULES_PATH=Path(__file__).with_name('direction-rules.v1.json')


def load_rules(path=RULES_PATH):
    raw=Path(path).read_bytes();rules=json.loads(raw)
    if not rules.get('version'):raise ValueError('Thiếu phiên bản quy tắc chiều')
    return rules,hashlib.sha256(raw).hexdigest()


def oneway(tags,profile,rules):
    """Direction restriction only, independent of access (no grant of access)."""
    walking=profile=='walking'
    keys=list(rules['walking_oneway_keys'] if walking else rules['motorized_oneway_keys'][profile])
    highway=tags.get('highway','')
    global_applies=not walking or highway in rules['walking_general_oneway_applies']
    ambiguous=walking and highway in rules['walking_general_oneway_ambiguous']
    if walking and (global_applies or ambiguous):keys+=['oneway']
    conditionals={key+':conditional':tags[key+':conditional'] for key in keys if key+':conditional' in tags}
    if conditionals:
        return {'mode':'unresolved','source_key':'oneway_conditional','source_value':json.dumps(conditionals,ensure_ascii=False),
                'reason':'Chiều có điều kiện chưa được diễn giải; không dùng chiều tĩnh thay thế'}
    chosen=next((key for key in keys if key in tags),None)
    if chosen:
        value=tags[chosen].strip().lower()
        if chosen=='oneway' and ambiguous and value not in rules['both_values']:
            return {'mode':'unresolved','source_key':chosen,'source_value':tags[chosen],
                    'reason':'oneway chung trên lối đi bộ/path chưa rõ áp dụng cho người hay xe; cần oneway:foot hoặc rà soát'}
        mode='forward' if value in rules['forward_values'] else 'both' if value in rules['both_values'] else 'backward' if value in rules['backward_values'] else 'unresolved'
        return {'mode':mode,'source_key':chosen,'source_value':tags[chosen],
                'reason':'Theo thứ tự nút của way OSM' if mode!='unresolved' else 'Giá trị chiều động/bất thường chưa hỗ trợ'}
    if not walking:
        if tags.get('junction') in rules['implicit_motorized_forward_junctions']:
            return {'mode':'forward','source_key':'junction','source_value':tags['junction'],
                    'reason':'Vòng xuyến có chiều thuận ngầm định, khi không có oneway ghi đè'}
        if highway in rules['implicit_motorized_forward_highways']:
            return {'mode':'forward','source_key':'highway','source_value':highway,
                    'reason':'Chiều thuận ngầm định của loại đường; không mở quyền access ngoài phạm vi'}
    return {'mode':'both','source_key':'missing_oneway_default','source_value':'',
            'reason':'Giả định hai chiều khi thiếu quy định áp dụng; không phải xác minh ngoài thực tế'}


def directional_access(tags,profile,direction,access_rules):
    """Most specific mode wins; direction variant before base within same mode."""
    keys=access_rules['profiles'][profile]['access_keys']
    clean={k:v for k,v in tags.items() if k not in {key+':'+d for key in keys for d in ['forward','backward']}}
    chosen=None
    for key in keys:
        if key+':'+direction in tags:
            chosen=key+':'+direction
            clean[key]=tags[chosen]
            break
        if key in tags:
            chosen=key
            break
    decision=access.classify(clean,profile,access_rules)
    return {**decision,'directional_access_key':chosen or decision['source_key'],
            'directional_access_value':tags.get(chosen,decision['source_value'])}


def classify(tags,profile,access_rules,direction_rules):
    # Validate profile/tags through existing access stage before any lookup.
    access.classify(tags,profile,access_rules)
    policy=oneway(tags,profile,direction_rules)
    out=[]
    for direction in ['forward','backward']:
        a=directional_access(tags,profile,direction,access_rules)
        p='unresolved' if policy['mode']=='unresolved' else 'permitted' if policy['mode'] in {'both',direction} else 'prohibited'
        if a['state']=='excluded':state='excluded'
        elif a['state']=='forbidden' or p=='prohibited':state='forbidden'
        elif a['state']=='unresolved' or p=='unresolved':state='unresolved'
        else:state=a['state']
        out.append({'profile':profile,'direction':direction,'state':state,
                    'eligible_after_access_direction':state=='allowed',
                    'access_state':a['state'],'access_key':a['directional_access_key'],
                    'access_value':a['directional_access_value'],'access_reason':a['reason'],
                    'access_warning':a['warning'],
                    'direction_state':p,'oneway_mode':policy['mode'],
                    'oneway_key':policy['source_key'],'oneway_value':policy['source_value'],
                    'direction_reason':policy['reason'],
                    'access_rules_version':access_rules['version'],
                    'direction_rules_version':direction_rules['version']})
    return out


def audit(snapshot,output,access_path=access.RULES_PATH,direction_path=RULES_PATH):
    ar,ar_hash=access.load_rules(access_path);dr,dr_hash=load_rules(direction_path)
    meta=json.loads((snapshot/'metadata.json').read_text(encoding='utf-8'))
    if meta.get('status')!='completed':raise ValueError('Snapshot chưa hoàn tất')
    raw_bytes=(snapshot/'osm-raw.json').read_bytes()
    raw=json.loads(raw_bytes)
    way_nodes={e['id']:e.get('nodes',[]) for e in raw['elements'] if e['type']=='way'}
    positions={e['id']:[e.get('lon'),e.get('lat')] for e in raw['elements'] if e['type']=='node'}
    road_bytes=(snapshot/'roads.geojson').read_bytes()
    features=json.loads(road_bytes)['features']
    rows=[];counts=Counter();modes=Counter();seen=set()
    for feature in features:
        p=feature['properties'];tags=p['osm_tags'];key=int(p['osm_way_id'])
        if p.get('scope')!='study_intersection' or tags.get('area')=='yes':continue
        if key in seen:raise ValueError('Trùng way trong GeoJSON')
        seen.add(key)
        nodes=way_nodes.get(key,[])
        coords=feature['geometry']['coordinates']
        # Check the complete sequence, not just endpoints of closed rings.
        order_ok=(len(nodes)==len(coords) and len(nodes)>=2
                  and all(positions.get(n)==c for n,c in zip(nodes,coords)))
        for profile in ar['profiles']:
            decisions=classify(tags,profile,ar,dr)
            modes[profile,decisions[0]['oneway_mode']]+=1
            for d in decisions:
                if not order_ok:
                    d['direction_state']='unresolved'
                    d['direction_reason']='Không đối chiếu được thứ tự hình học với nút OSM gốc'
                    if d['access_state'] not in {'excluded','forbidden'}:d['state']='unresolved'
                    d['eligible_after_access_direction']=False
                counts[profile,d['direction'],d['state']]+=1
                rows.append({'osm_way_id':key,'name':tags.get('name',''),'highway':tags['highway'],
                             'first_node':nodes[0] if nodes else '', 'last_node':nodes[-1] if nodes else '',
                             'node_order_verified':order_ok,**d})
    output.mkdir(parents=True,exist_ok=True)
    run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
    fields=['osm_way_id','name','highway','first_node','last_node','node_order_verified',
            'profile','direction','state','eligible_after_access_direction','access_state','access_key',
            'access_value','access_reason','access_warning','direction_state','oneway_mode','oneway_key',
            'oneway_value','direction_reason','access_rules_version','direction_rules_version']
    access.csv_write(run/'way-directions.csv',fields,rows)
    summary=[{'profile':p,'direction':d,'state':s,'way_count':counts[p,d,s],'denominator':len(seen)}
             for p in ar['profiles'] for d in ['forward','backward']
             for s in ['allowed','forbidden','restricted','unresolved','excluded']]
    access.csv_write(run/'direction-summary.csv',['profile','direction','state','way_count','denominator'],summary)
    access.csv_write(run/'oneway-modes.csv',['profile','mode','way_count'],
                     [{'profile':p,'mode':mode,'way_count':modes[p,mode]}
                      for p in ar['profiles'] for mode in ['forward','backward','both','unresolved']])
    (run/'access-rules-used.json').write_bytes(Path(access_path).read_bytes())
    (run/'direction-rules-used.json').write_bytes(Path(direction_path).read_bytes())
    metadata={'dataset_version':meta['dataset_version'],'access_rules_version':ar['version'],
              'direction_rules_version':dr['version'],'access_rules_sha256':ar_hash,'direction_rules_sha256':dr_hash,
              'osm_raw_sha256':hashlib.sha256(raw_bytes).hexdigest(),'roads_sha256':hashlib.sha256(road_bytes).hexdigest(),
              'created_at':datetime.now(timezone.utc).isoformat(),'way_count':len(seen),'decision_count':len(rows),
              'node_order_unverified_ways':len({r['osm_way_id'] for r in rows if not r['node_order_verified']}),
              'scope':'study_intersection linear ways; one decision per way/profile/direction, not graph edges',
              'not_evaluated':['time-dependent rules','turn restrictions','barriers','dimensions','speed','flood']}
    (run/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    return run,summary


def main(argv=None):
    parser=argparse.ArgumentParser(description='Chiều lưu thông + access, chưa tạo graph')
    parser.add_argument('--snapshot',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('data/routing-direction'))
    parser.add_argument('--access-rules',type=Path,default=access.RULES_PATH)
    parser.add_argument('--direction-rules',type=Path,default=RULES_PATH)
    args=parser.parse_args(argv)
    try:
        run,summary=audit(args.snapshot,args.output,args.access_rules,args.direction_rules)
        print('Kết quả:',run.resolve())
        for r in summary:
            if r['state']=='allowed':print(r['profile'],r['direction'],'qua access + chiều:',r['way_count'])
        print('Chưa xét cấm rẽ, rào chắn, tốc độ hoặc ngập. Chưa tạo graph.')
        return 0
    except (OSError,ValueError,KeyError,TypeError) as exc:
        print('LỖI:',exc,file=sys.stderr);return 1


if __name__=='__main__':sys.exit(main())
