#!/usr/bin/env python3
"""OSM raw-data survey; Python 3.10+, standard library only. Not a router."""
import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

VERSION = "1.0.0"
DEFAULT_BBOX = [105.800, 20.990, 105.850, 21.040]  # west,south,east,north
DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter"
TAGS = ["name", "oneway", "oneway:motorcar", "oneway:motorcycle", "oneway:foot",
        "access", "vehicle", "motor_vehicle", "motorcar", "motorcycle", "foot",
        "maxspeed", "maxspeed:forward", "maxspeed:backward", "maxspeed:motorcar",
        "maxspeed:motorcycle", "maxspeed:conditional", "surface", "smoothness",
        "width", "bridge", "tunnel", "layer", "service"]
ACCESS_TAGS = {"access", "vehicle", "motor_vehicle", "motorcar", "motorcycle", "foot"}


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")


def write_csv(path, fields, rows):
    # BOM and real CSV quoting make Vietnamese/embedded commas work in Excel.
    # External OSM text must not become an executable spreadsheet formula.
    def cell(value):
        if isinstance(value, str) and value.lstrip(" \t\r\n").startswith(("=", "+", "-", "@")):
            return "'" + value
        return value
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="raise")
        writer.writeheader()
        writer.writerows({key: cell(value) for key, value in row.items()} for row in rows)


def validate_bbox(bbox):
    if len(bbox) != 4 or not all(math.isfinite(v) for v in bbox):
        raise ValueError("BBOX cần 4 số hữu hạn: tây nam đông bắc")
    w, s, e, n = bbox
    if not (-180 <= w < e <= 180 and -80 <= s < n <= 80):
        raise ValueError("BBOX không hợp lệ; công cụ hỗ trợ vĩ độ -80 đến 80")
    return bbox


def padded_bbox(bbox, km):
    """Rectangular approximate padding, NOT an exact geodesic polygon buffer."""
    if not math.isfinite(km) or not 0 <= km <= 10:
        raise ValueError("Vùng đệm phải từ 0 đến 10 km")
    w, s, e, n = validate_bbox(bbox)
    dy = km / 110.0
    extreme_lat = max(abs(s - dy), abs(n + dy))
    dx = km / (110.0 * math.cos(math.radians(extreme_lat)))
    return validate_bbox([w - dx, s - dy, e + dx, n + dy])


def area_feature(bbox, label):
    w, s, e, n = bbox
    return {"type": "FeatureCollection", "features": [{"type": "Feature",
            "properties": {"name": label}, "geometry": {"type": "Polygon",
            "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}}]}


def build_query(bbox, timeout):
    w, s, e, n = bbox
    box = ",".join(format(v, ".8f") for v in [s, w, n, e])
    # Parent restrictions of selected highway ways, including ones whose via
    # lies just outside bbox; recurse all members to avoid dangling references.
    return f'''[out:json][timeout:{timeout}][maxsize:134217728];
way["highway"]({box})->.roads;
rel(bw.roads)["type"="restriction"]->.turns;
node["barrier"]({box})->.barriers;
(.roads;.turns;.barriers;);
(._; >>;);
out body;
'''


def parse_data(raw):
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("elements"), list):
        raise ValueError("Không phải Overpass JSON có mảng elements")
    if data.get("remark"):
        raise ValueError("Overpass báo lỗi/kết quả có thể thiếu: " + str(data["remark"]))
    elements = {}
    for elem in data["elements"]:
        if not isinstance(elem, dict) or elem.get("type") not in {"node", "way", "relation"}:
            raise ValueError("Phần tử OSM không hợp lệ")
        if not isinstance(elem.get("id"), int) or isinstance(elem["id"], bool):
            raise ValueError("Phần tử thiếu mã OSM nguyên")
        key = (elem["type"], elem["id"])
        if key in elements and elements[key] != elem:
            raise ValueError("Hai bản ghi khác nhau có cùng mã OSM: " + str(key))
        if "tags" in elem and (not isinstance(elem["tags"], dict)
                               or not all(isinstance(k, str) and isinstance(v, str)
                                          for k, v in elem["tags"].items())):
            raise ValueError("Tags OSM phải là object chuỗi")
        elements[key] = elem
    return data, elements


def node_position(node):
    if not node:
        return None
    lng, lat = node.get("lon"), node.get("lat")
    if (isinstance(lng, (int, float)) and not isinstance(lng, bool)
            and isinstance(lat, (int, float)) and not isinstance(lat, bool)
            and math.isfinite(lng) and math.isfinite(lat)
            and -180 <= lng <= 180 and -90 <= lat <= 90):
        return [lng, lat]
    return None


def point_in_box(p, box):
    w, s, e, n = box
    return w <= p[0] <= e and s <= p[1] <= n


def segment_intersects_box(a, b, box):
    # Liang-Barsky; also detects long segments crossing bbox without nodes inside.
    w, s, e, n = box
    dx, dy = b[0] - a[0], b[1] - a[1]
    lo, hi = 0.0, 1.0
    for p, q in [(-dx, a[0]-w), (dx, e-a[0]), (-dy, a[1]-s), (dy, n-a[1])]:
        if p == 0:
            if q < 0:
                return False
        else:
            r = q / p
            if p < 0:
                lo = max(lo, r)
            else:
                hi = min(hi, r)
            if lo > hi:
                return False
    return True


def intersects_box(coords, box):
    return (any(point_in_box(p, box) for p in coords)
            or any(segment_intersects_box(a, b, box) for a, b in zip(coords, coords[1:])))


def length_meters(coords):
    total = 0.0
    for a, b in zip(coords, coords[1:]):
        lat1, lat2 = math.radians(a[1]), math.radians(b[1])
        dlat, dlon = lat2-lat1, math.radians(b[0]-a[0])
        h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
        total += 2 * 6371008.8 * math.asin(math.sqrt(min(1.0, max(0.0, h))))
    return total


def parse_speed(value):
    """Only simple scalar km/h or mph; conditional/list/symbolic kept unresolved."""
    if not isinstance(value, str):
        return None
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(km/h|kmh|kph|mph)?\s*", value, re.I)
    if not m:
        return None
    speed = float(m[1]) * (1.609344 if (m[2] or "").lower() == "mph" else 1)
    return speed if math.isfinite(speed) and speed > 0 else None


def summarize(data, elements, study_box, download_box):
    issues, features, rows = [], [], []

    def issue(kind, elem, field, message):
        issues.append({"issue": kind, "osm_type": elem["type"], "osm_id": elem["id"],
                       "field": field, "detail": message,
                       "osm_url": f'https://www.openstreetmap.org/{elem["type"]}/{elem["id"]}'})

    ways = sorted((e for e in elements.values() if e["type"] == "way" and
                   e.get("tags", {}).get("highway")), key=lambda e: e["id"])
    for way in ways:
        tags = way["tags"]
        ids = way.get("nodes", [])
        positions = [node_position(elements.get(("node", nid))) for nid in ids]
        geometry_ok = len(ids) >= 2 and all(p is not None for p in positions)
        if not geometry_ok:
            issue("incomplete_geometry", way, "nodes", "Thiếu tọa độ/nút hoặc ít hơn 2 nút; không xuất hình học giả")
        # Relation dependencies outside download box stay in raw but not denominator.
        in_download = intersects_box(positions, download_box) if geometry_ok else None
        scope = "study_intersection" if geometry_ok and intersects_box(positions, study_box) else (
            "download_buffer" if in_download else "dependency_outside" if geometry_ok else "unknown_geometry")
        area = tags.get("area") == "yes"
        candidate = not area and in_download is True
        if geometry_ok and length_meters(positions) <= 0:
            issue("zero_length", way, "nodes", "Hình học có chiều dài bằng 0")
        if area:
            issue("area_way", way, "area", "Mặt đường dạng vùng; giữ dữ liệu nhưng chưa coi là cạnh tuyến tính")
        if candidate:
            for tag in ["name", "maxspeed"]:
                if not tags.get(tag):
                    issue("missing_tag", way, tag, "Thiếu thuộc tính; chưa kết luận ngoài thực địa không có")
            if not any(k in tags for k in ACCESS_TAGS):
                issue("access_not_explicit", way, "access", "Cần quy tắc mặc định; không tự suy ra được phép/cấm")
            if tags.get("oneway") and tags["oneway"] not in {"yes", "no", "-1", "1", "true", "false", "0"}:
                issue("unresolved_oneway", way, "oneway", tags["oneway"])
            for key, value in tags.items():
                if key == "maxspeed" or key.startswith("maxspeed:"):
                    if parse_speed(value) is None:
                        issue("unresolved_speed", way, key, value)
                if ":conditional" in key:
                    issue("conditional_rule", way, key, "Chỉ lưu, chưa đánh giá: " + value)
        row = {"osm_way_id": way["id"], "scope": scope, "candidate": candidate,
               "geometry_ok": geometry_ok, "node_count": len(ids), "highway": tags["highway"],
               "length_m": round(length_meters(positions), 3) if geometry_ok else "",
               "maxspeed_scalar_kmh": parse_speed(tags.get("maxspeed")) or "",
               "osm_url": f'https://www.openstreetmap.org/way/{way["id"]}'}
        row.update({key: tags.get(key, "") for key in TAGS})
        rows.append(row)
        if geometry_ok:
            features.append({"type": "Feature", "properties": {**row, "osm_tags": tags},
                             "geometry": {"type": "LineString", "coordinates": positions}})

    relations = []
    for rel in sorted((e for e in elements.values() if e["type"] == "relation"
                       and e.get("tags", {}).get("type") == "restriction"), key=lambda e: e["id"]):
        members = rel.get("members", [])
        missing = [m for m in members if (m.get("type"), m.get("ref")) not in elements]
        for member in missing:
            issue("missing_relation_member", rel, "members", json.dumps(member, ensure_ascii=False))
        roles = Counter(m.get("role") for m in members)
        via_nodes = [m for m in members if m.get("role") == "via" and m.get("type") == "node"]
        simple = (roles["from"] == 1 and roles["to"] == 1 and roles["via"] == 1
                  and len(via_nodes) == 1
                  and all(m.get("type") == "way" for m in members if m.get("role") in {"from", "to"})
                  and len(members) == 3)
        if not simple:
            issue("complex_restriction", rel, "members", "Không phải dạng đơn giản from-way/via-node/to-way")
        tags = rel.get("tags", {})
        if any(":conditional" in k for k in tags):
            issue("conditional_restriction", rel, "tags", "Có điều kiện; chưa diễn giải")
        relations.append({"id": rel["id"], "tags": tags, "members": members,
                          "simple_via_node_shape": simple,
                          "members_complete": not missing,
                          "routing_rule_evaluated": False})

    barriers = []
    for node in sorted((e for e in elements.values() if e["type"] == "node"
                        and e.get("tags", {}).get("barrier")), key=lambda e: e["id"]):
        pos = node_position(node)
        if pos:
            barriers.append({"type": "Feature", "properties": {"osm_node_id": node["id"], **node["tags"]},
                             "geometry": {"type": "Point", "coordinates": pos}})
        else:
            issue("invalid_barrier_position", node, "coordinates", "Không có tọa độ hợp lệ")

    candidates = [r for r in rows if r["candidate"]]
    study = [r for r in candidates if r["scope"] == "study_intersection"]
    tag_lookup = {w["id"]: w["tags"] for w in ways}
    summary = []

    def metric(scope, key, label, count, denom=None, note=""):
        summary.append({"scope": scope, "metric": key, "label": label, "count": count,
                        "denominator": denom if denom is not None else "",
                        "percent": round(count/denom*100, 3) if denom else "",
                        "note": note})

    metric("raw", "elements_unique", "Phần tử OSM duy nhất", len(elements))
    metric("raw", "duplicate_elements", "Bản ghi lặp giống nhau đã khử", len(data["elements"])-len(elements))
    metric("raw", "highway_ways", "Đường nguồn có highway, gồm dependency", len(ways))
    metric("raw", "unknown_geometry_ways", "Đường không xác định được phạm vi vì thiếu hình học",
           sum(r["scope"] == "unknown_geometry" for r in rows), note="Không đưa vào mẫu số theo vùng")
    metric("raw", "restriction_relations", "Quan hệ hạn chế rẽ duy nhất", len(relations), note="Không phải số lệnh cấm đã xử lý được")
    metric("raw", "barrier_nodes", "Nút có barrier", len(barriers))
    for scope, group in [("download_intersection", candidates), ("study_intersection", study)]:
        n = len(group)
        metric(scope, "linear_highway_ways", "Đường nguồn dạng tuyến giao vùng", n,
               note="Tính theo OSM way, chưa phải cạnh định tuyến; chưa lọc quyền đi")
        for tag in TAGS:
            metric(scope, "tag:"+tag, "Có thuộc tính "+tag,
                   sum(bool(tag_lookup[r["osm_way_id"]].get(tag)) for r in group), n,
                   "Độ đầy đủ thuộc tính, không phải độ chính xác ngoài thực địa")
        metric(scope, "maxspeed_scalar", "maxspeed đọc được thành số đơn km/h",
               sum(parse_speed(tag_lookup[r["osm_way_id"]].get("maxspeed")) is not None for r in group), n)
        metric(scope, "any_speed_tag", "Có ít nhất một thuộc tính maxspeed*",
               sum(any(k == "maxspeed" or k.startswith("maxspeed:") for k in tag_lookup[r["osm_way_id"]]) for r in group), n)
        metric(scope, "any_explicit_access", "Có ít nhất một thuộc tính quyền đi",
               sum(any(k in tag_lookup[r["osm_way_id"]] for k in ACCESS_TAGS) for r in group), n)
        for road_class, count in sorted(Counter(r["highway"] for r in group).items()):
            metric(scope, "highway:"+road_class, "Loại đường "+road_class, count, n)
        for value, count in sorted(Counter(r["oneway"] or "(missing)" for r in group).items()):
            metric(scope, "oneway:"+value, "Giá trị oneway "+value, count, n,
                   "Thiếu oneway không đồng nghĩa chắc chắn hai chiều")
    return {"roads": {"type": "FeatureCollection", "features": features}, "rows": rows,
            "restrictions": relations, "barriers": {"type": "FeatureCollection", "features": barriers},
            "summary": summary, "issues": issues}


def fetch_raw(endpoint, query, timeout, user_agent):
    if not endpoint.startswith("https://"):
        raise ValueError("Endpoint phải dùng HTTPS")
    request = urllib.request.Request(endpoint, data=urllib.parse.urlencode({"data": query}).encode(),
                                     headers={"User-Agent": user_agent, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout+15) as response:
        raw = response.read(128*1024*1024+1)
    if len(raw) > 128*1024*1024:
        raise ValueError("Phản hồi vượt 128 MiB; hãy giảm phạm vi")
    parse_data(raw)  # Reject HTTP 200 + runtime-error partial payloads.
    return raw


def main(argv=None):
    parser = argparse.ArgumentParser(description="Khảo sát OSM độc lập; không sửa DB/web")
    parser.add_argument("--bbox", nargs=4, type=float, default=DEFAULT_BBOX,
                        metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    parser.add_argument("--buffer-km", type=float, default=2.0)
    parser.add_argument("--output", type=Path, default=Path("data/osm-survey"))
    parser.add_argument("--input", type=Path, help="Overpass JSON có nodes/ways/relations, không phải GeoJSON")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    parser.add_argument("--timeout", type=int, default=90)
    parser.add_argument("--user-agent", default="HanoiFloodRouting-OSMSurvey/1.0")
    parser.add_argument("--prepare-only", action="store_true", help="Chỉ xuất ranh giới và query, không gọi mạng")
    args = parser.parse_args(argv)
    try:
        study = validate_bbox(args.bbox)
        download = padded_bbox(study, args.buffer_km)
        if not 10 <= args.timeout <= 300:
            raise ValueError("Timeout phải từ 10 đến 300 giây")
        # Avoid accidental requests covering huge areas.
        if (download[2]-download[0])*(download[3]-download[1])*12364 > 500:
            raise ValueError("Vùng tải vượt khoảng 500 km²; chia nhỏ phạm vi")
        if args.input and args.prepare_only:
            raise ValueError("Không kết hợp --input với --prepare-only")
        args.output.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        run = args.output / stamp
        run.mkdir()  # Every run has its own directory; never clobber a snapshot.
        query = build_query(download, args.timeout)
        write_json(run/"study-area.geojson", area_feature(study, "Vùng phục vụ"))
        write_json(run/"download-area.geojson", area_feature(download, "Khung tải đệm xấp xỉ"))
        (run/"query.overpassql").write_text(query, encoding="utf-8")
        metadata = {"tool_version": VERSION, "started_at": utc_now(), "status": "prepared",
                    "study_bbox_wsen": study, "download_bbox_wsen": download,
                    "buffer_km": args.buffer_km,
                    "buffer_method": "approximate rectangular geographic padding, not exact metric polygon buffer",
                    "query_sha256": hashlib.sha256(query.encode()).hexdigest(),
                    "download_endpoint": args.endpoint if not args.input else None,
                    "input_file": str(args.input.resolve()) if args.input else None,
                    "source": "OpenStreetMap contributors", "license": "ODbL 1.0",
                    "attribution_url": "https://www.openstreetmap.org/copyright",
                    "scope_note": "raw survey only; no access/speed/turn rules evaluated; no routing graph built",
                    "coverage_note": "bbox selection uses OSM node inclusion; a crossing way with no node inside may be absent"}
        write_json(run/"metadata.json", metadata)
        print("Thư mục kết quả:", run.resolve(), flush=True)
        if args.prepare_only:
            print("Đã tạo query và ranh giới. Chưa tải hoặc khảo sát dữ liệu.")
            return 0
        try:
            print("Đọc file đầu vào..." if args.input else "Đang tải OSM (không gọi API của dự án)...", flush=True)
            raw = args.input.read_bytes() if args.input else fetch_raw(args.endpoint, query, args.timeout, args.user_agent)
            # Keep exact bytes even for invalid offline input, for diagnosis.
            (run/"osm-raw.json").write_bytes(raw)
            data, elements = parse_data(raw)
            results = summarize(data, elements, study, download)
            write_json(run/"roads.geojson", results["roads"])
            write_json(run/"restrictions.json", results["restrictions"])
            write_json(run/"barriers.geojson", results["barriers"])
            write_csv(run/"roads.csv", ["osm_way_id", "scope", "candidate", "geometry_ok", "node_count",
                      "highway", "length_m", "maxspeed_scalar_kmh", "osm_url"] + TAGS, results["rows"])
            write_csv(run/"survey-summary.csv", ["scope", "metric", "label", "count", "denominator", "percent", "note"], results["summary"])
            write_csv(run/"survey-issues.csv", ["issue", "osm_type", "osm_id", "field", "detail", "osm_url"], results["issues"])
            write_csv(run/"manual-review.csv", ["osm_type", "osm_id", "test_case", "evidence_url", "observed_at", "conclusion", "note"], [])
            metadata.update({"status": "completed", "completed_at": utc_now(),
                             "raw_sha256": hashlib.sha256(raw).hexdigest(),
                             "dataset_version": "osm-"+hashlib.sha256(raw).hexdigest()[:16],
                             "osm3s": data.get("osm3s"), "input_generator": data.get("generator"),
                             "unique_elements": len(elements),
                             "issue_count": len(results["issues"]),
                             "completeness_warning": any(x["issue"] in {"incomplete_geometry", "missing_relation_member"} for x in results["issues"]),
                             "input_coverage_verified": False if args.input else None})
            write_json(run/"metadata.json", metadata)
            for row in results["summary"]:
                if row["metric"] in {"linear_highway_ways", "restriction_relations", "unknown_geometry_ways"}:
                    print(row["scope"], row["label"], "=", row["count"])
            print("Hoàn tất. Xem survey-summary.csv và survey-issues.csv.")
            return 0
        except Exception as exc:
            metadata.update({"status": "failed", "failed_at": utc_now(), "error": str(exc)})
            write_json(run/"metadata.json", metadata)
            raise
    except (ValueError, OSError, urllib.error.URLError, TimeoutError) as exc:
        print("LỖI:", exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
