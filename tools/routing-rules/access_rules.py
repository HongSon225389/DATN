#!/usr/bin/env python3
"""Explainable WAY access classification. Does not build a graph or route."""
import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

RULES_PATH = Path(__file__).with_name("access-rules.v1.json")
STATES = {"allowed", "forbidden", "restricted", "unresolved", "excluded"}


def load_rules(path=RULES_PATH):
    raw=Path(path).read_bytes(); rules=json.loads(raw)
    if set(rules["profiles"]) != {"car","motorcycle","walking"}:
        raise ValueError("Cấu hình cần đủ ba phương tiện")
    for table in [*rules["highway_defaults"].values(),rules["default_if_unknown_highway"]]:
        if set(table)!=set(rules["profiles"]) or not set(table.values())<=STATES:
            raise ValueError("Bảng mặc định không hợp lệ")
    return rules,hashlib.sha256(raw).hexdigest()


def classify(tags, profile, rules):
    if profile not in rules["profiles"]: raise ValueError("Phương tiện không hợp lệ")
    if not isinstance(tags,dict) or not all(isinstance(k,str) and isinstance(v,str) for k,v in tags.items()):
        raise ValueError("OSM tags cần là object chuỗi")
    keys=rules["profiles"][profile]["access_keys"]
    highway=tags.get("highway","")
    trace={k:tags[k] for k in keys if k in tags}

    def result(state,source_key,source_value,reason,warning=""):
        return {"profile":profile,"state":state,"source_key":source_key,
                "source_value":source_value,"reason":reason,"warning":warning,
                "through_eligible_by_way_access":state=="allowed",
                "access_trace":trace,"rules_version":rules["version"]}

    if not highway:
        return result("excluded","highway","","Không có highway; không phải đối tượng đường được hỗ trợ")
    if tags.get("area")=="yes":
        return result("excluded","area","yes","Dạng vùng; chưa tạo cạnh tuyến tính trong phiên bản này")
    if highway in rules["excluded_highways"]:
        return result("excluded","highway",highway,"Ngoài phạm vi mạng đường phiên bản thí điểm; không kết luận là lệnh cấm pháp luật")
    if any(tags.get(k)=="yes" for k in ["disused","abandoned"]):
        return result("excluded","lifecycle","yes","Đường có dấu hiệu không còn sử dụng; cần rà soát")
    if profile!="walking" and highway in rules["motorized_unsupported_highways"]:
        return result("excluded","highway",highway,"Không hỗ trợ xe cơ giới trên loại đường này trong mô hình")

    # Conditional/directional/lane access cannot silently become static permission.
    pending={k:v for k,v in tags.items() if any(k.startswith(key+":") for key in keys)}
    if pending:
        return result("unresolved","qualified_access",json.dumps(pending,ensure_ascii=False),
                      "Có quyền đi theo điều kiện/chiều/làn; chờ bộ xử lý tương ứng")
    if tags.get("motorroad")=="yes" and profile in {"motorcycle","walking"}:
        return result("unresolved","motorroad","yes","Cần quy tắc địa phương và kiểm tra thuộc tính; không suy quyền từ tên loại đường")

    default=rules["highway_defaults"].get(highway,rules["default_if_unknown_highway"])[profile]
    chosen=next((k for k in keys if k in tags),None)
    if chosen is None:
        return result(default,"highway_default",highway,"Dùng giả định mặc định theo loại đường", "Chưa được xác minh ngoài thực tế; không bảo đảm khả năng đi qua")
    value=tags[chosen].strip().lower()
    if value in rules["forbidden_values"]:
        return result("forbidden",chosen,tags[chosen],"Không đưa vào quyền đi công cộng theo giá trị tag", "use_sidepath yêu cầu dùng lối khác; chưa tự nối lối thay thế" if value=="use_sidepath" else "")
    if value in rules["restricted_values"]:
        return result("restricted",chosen,tags[chosen],"Có điều kiện đối tượng/mục đích/quyền riêng; không dùng để đi xuyên công cộng", "destination không phải cấm tuyệt đối; xử lý tiếp cận đầu/cuối hành trình ở giai đoạn sau")
    if value in rules["allowed_values"]:
        if chosen=="access" and value in {"designated","official"}:
            return result("unresolved",chosen,tags[chosen],"Giá trị cần khóa phương tiện cụ thể, không suy từ access chung")
        if chosen=="access" and default!="allowed":
            return result(default,"highway_default",highway,"access cho phép chung chưa đủ để mở loại đường mặc định hạn chế/chưa rõ cho phương tiện", "Cần thuộc tính phương tiện cụ thể hoặc rà soát")
        warning="Chỉ xét quyền way; còn phải kiểm tra chiều, rẽ, barrier, kích thước và ngập"
        if value=="permissive":warning+="; quyền permissive có thể bị chủ quản thu hồi"
        if value=="discouraged":warning+="; nguồn không khuyến khích sử dụng, chưa tính phạt ở bước này"
        if chosen!="access" and default in {"forbidden","unresolved"}:
            warning+="; thuộc tính phương tiện ghi đè giả định loại đường, cần đưa vào mẫu rà soát"
        return result("allowed",chosen,tags[chosen],"Áp dụng khóa quyền đi cụ thể nhất có mặt trong chuỗi kế thừa",warning)
    return result("unresolved",chosen,tags[chosen],"Giá trị chưa hỗ trợ hoặc bất thường; không bỏ qua để dùng khóa tổng quát hơn")


def csv_write(path, fields, rows):
    def safe(v):
        if isinstance(v,str) and v.lstrip().startswith(("=","+","-","@")):return "'"+v
        return v
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for row in rows:w.writerow({k:safe(v) for k,v in row.items()})


def audit(snapshot, output, rules_path=RULES_PATH):
    rules,rules_hash=load_rules(rules_path)
    meta=json.loads((snapshot/'metadata.json').read_text(encoding='utf-8'))
    if meta.get('status')!='completed':raise ValueError('Snapshot chưa hoàn tất')
    road_bytes=(snapshot/'roads.geojson').read_bytes()
    features=json.loads(road_bytes)['features']
    rows=[]; counts=Counter();source_counts=Counter(); ways=set()
    for f in features:
        p=f['properties'];tags=p['osm_tags']
        if p.get('scope')!='study_intersection' or tags.get('area')=='yes':continue
        key=int(p['osm_way_id'])
        if key in ways:raise ValueError('Trùng way trong roads.geojson')
        ways.add(key)
        for profile in rules['profiles']:
            d=classify(tags,profile,rules)
            counts[profile,d['state']]+=1;source_counts[profile,d['source_key']]+=1
            rows.append({'osm_way_id':key,'highway':tags['highway'],'name':tags.get('name',''),
                         **{k:v for k,v in d.items() if k!='access_trace'},
                         'access_trace':json.dumps(d['access_trace'],ensure_ascii=False),
                         'osm_url':f'https://www.openstreetmap.org/way/{key}'})
    output.mkdir(parents=True,exist_ok=True)
    run=output/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run.mkdir()
    fields=['osm_way_id','highway','name','profile','state','source_key','source_value','reason','warning',
            'through_eligible_by_way_access','rules_version','access_trace','osm_url']
    csv_write(run/'way-access.csv',fields,rows)
    summary=[{'profile':p,'state':s,'way_count':counts[p,s],'denominator':len(ways),
              'percent':round(counts[p,s]*100/len(ways),3) if ways else ''}
             for p in rules['profiles'] for s in ['allowed','forbidden','restricted','unresolved','excluded']]
    csv_write(run/'access-summary.csv',['profile','state','way_count','denominator','percent'],summary)
    csv_write(run/'access-rule-sources.csv',['profile','source_key','way_count'],
              [{'profile':p,'source_key':k,'way_count':v} for (p,k),v in sorted(source_counts.items())])
    defaults=[{'highway':h,**v} for h,v in rules['highway_defaults'].items()]
    csv_write(run/'highway-defaults.csv',['highway','car','motorcycle','walking'],defaults)
    (run/'rules-used.json').write_bytes(Path(rules_path).read_bytes())
    result_meta={'rules_version':rules['version'],'rules_sha256':rules_hash,
                 'dataset_version':meta['dataset_version'],'roads_sha256':hashlib.sha256(road_bytes).hexdigest(),
                 'created_at':datetime.now(timezone.utc).isoformat(),'study_bbox':meta['study_bbox_wsen'],
                 'way_count':len(ways),'decision_count':len(rows),'unit':'OSM ways, not graph edges',
                 'scope':'study_intersection, area!=yes; way-level access classification only',
                 'not_evaluated':['oneway','turn restrictions','barriers','size limits','speed','flood'],
                 'note':'allowed means passes this access stage only; defaults are research assumptions, not verified law'}
    (run/'metadata.json').write_text(json.dumps(result_meta,ensure_ascii=False,indent=2),encoding='utf-8')
    return run,summary


def main(argv=None):
    parser=argparse.ArgumentParser(description='Bảng quyền đi v0.1 — chưa tạo graph hoặc sửa DB')
    parser.add_argument('--snapshot',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('data/routing-access'))
    parser.add_argument('--rules',type=Path,default=RULES_PATH)
    args=parser.parse_args(argv)
    try:
        run,summary=audit(args.snapshot,args.output,args.rules)
        print('Kết quả:',run.resolve())
        for row in summary:print(row['profile'],row['state'],row['way_count'])
        print('Chỉ phân loại quyền way. Chưa phải quyền tuyến hoàn chỉnh hoặc xác minh thực địa.')
        return 0
    except (OSError,ValueError,KeyError,TypeError) as e:
        print('LỖI:',e,file=sys.stderr);return 1


if __name__=='__main__':sys.exit(main())
