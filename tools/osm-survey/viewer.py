#!/usr/bin/env python3
"""Local, read-only OSM survey viewer. No project API/DB access."""
import argparse
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlsplit

from survey import node_position, point_in_box, validate_bbox

STATIC = Path(__file__).parent / "viewer"
MAX_FEATURES = 3000


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def auto_snapshot(root):
    choices = []
    for path in root.glob("*/metadata.json"):
        try:
            meta = read_json(path)
            if meta.get("status") == "completed" and (path.parent/"roads.geojson").is_file():
                choices.append(path.parent)
        except (OSError, ValueError):
            continue
    if not choices:
        raise ValueError("Không có snapshot hoàn tất. Dùng --snapshot đường/dẫn/thư/mục/phiên/bản")
    return sorted(choices)[-1]


def feature_bounds(feature):
    geom = feature["geometry"]
    coords = [geom["coordinates"]] if geom["type"] == "Point" else geom["coordinates"]
    return [min(p[0] for p in coords), min(p[1] for p in coords),
            max(p[0] for p in coords), max(p[1] for p in coords)]


def intersects(a, b):
    return a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]


class Dataset:
    def __init__(self, snapshot):
        self.snapshot = Path(snapshot)
        self.meta = read_json(self.snapshot/"metadata.json")
        if self.meta.get("status") != "completed":
            raise ValueError("Snapshot chưa hoàn tất")
        self.study = self.meta["study_bbox_wsen"]
        self.download = self.meta["download_bbox_wsen"]
        self.roads = {}
        for feature in read_json(self.snapshot/"roads.geojson")["features"]:
            props = feature["properties"]
            key = int(props["osm_way_id"])
            tags = props["osm_tags"]
            flags = []
            if not any(k == "maxspeed" or k.startswith("maxspeed:") for k in tags):
                flags.append("missing_speed")
            if not any(k in tags for k in ["access", "vehicle", "motor_vehicle", "motorcar", "motorcycle", "foot"]):
                flags.append("missing_access")
            if not tags.get("name"):
                flags.append("missing_name")
            if any(":conditional" in k for k in tags):
                flags.append("conditional")
            if tags.get("area") == "yes":
                flags.append("area")
            self.roads[key] = {"feature": feature, "bbox": feature_bounds(feature), "flags": flags,
                               "search": (str(key)+" "+tags.get("name", "")+" "+tags.get("highway", "")).casefold()}
        self.barriers = {int(f["properties"]["osm_node_id"]): f for f in
                         read_json(self.snapshot/"barriers.geojson")["features"]}
        self.restrictions = {int(r["id"]): r for r in read_json(self.snapshot/"restrictions.json")}
        # Only keep raw node positions needed for locating turn relations.
        needed = {m["ref"] for rel in self.restrictions.values() for m in rel["members"]
                  if m["type"] == "node" and m["role"] == "via"}
        raw = read_json(self.snapshot/"osm-raw.json")
        nodes = {n["id"]: node_position(n) for n in raw["elements"] if n["type"] == "node" and n["id"] in needed}
        self.turn_points = {}
        for key, rel in self.restrictions.items():
            via_nodes = [nodes.get(m["ref"]) for m in rel["members"] if m["type"] == "node" and m["role"] == "via"]
            pos = next((p for p in via_nodes if p), None)
            location_method = "via_node" if pos else "unlocated"
            if pos is None:
                via_ways = [self.roads.get(m["ref"]) for m in rel["members"] if m["type"] == "way" and m["role"] == "via"]
                way = next((w for w in via_ways if w), None)
                if way:
                    coords = way["feature"]["geometry"]["coordinates"]
                    pos = coords[len(coords)//2]
                    location_method = "via_way_representative"
            if pos:
                self.turn_points[key] = {"type": "Feature", "geometry": {"type": "Point", "coordinates": pos},
                    "properties": {"osm_id": key, "kind": "relation", "location_method": location_method,
                                   "label": "Hạn chế rẽ " + str(key)}}

    def info(self):
        return {"dataset_version": self.meta["dataset_version"], "snapshot": self.snapshot.name,
                "study_bbox": self.study, "download_bbox": self.download,
                "source_time": (self.meta.get("osm3s") or {}).get("timestamp_osm_base"),
                "classes": dict(sorted(Counter(r["feature"]["properties"]["highway"] for r in self.roads.values()).items())),
                "road_count": len(self.roads), "barrier_count": len(self.barriers),
                "restriction_count": len(self.restrictions), "located_restrictions": len(self.turn_points),
                "study_area": read_json(self.snapshot/"study-area.geojson"),
                "download_area": read_json(self.snapshot/"download-area.geojson"),
                "synthetic": "SYNTHETIC" in str(self.meta.get("input_generator", ""))}

    def filtered(self, params):
        scope, road_class, flag = params.get("scope", "study"), params.get("class", ""), params.get("flag", "")
        geometry = params.get("geometry", "area" if flag == "area" else "linear")
        if geometry not in {"linear", "area", "all"}:
            raise ValueError("Bộ lọc hình học không hợp lệ")
        if scope not in {"study", "download", "all"}:
            raise ValueError("scope không hợp lệ")
        if flag not in {"", "missing_speed", "missing_access", "missing_name", "conditional", "oneway", "bridge", "steps", "area"}:
            raise ValueError("Bộ lọc thuộc tính không hợp lệ")
        query = params.get("q", "").strip().casefold()
        if len(query) > 200:
            raise ValueError("Từ tìm kiếm quá dài")
        for key, road in self.roads.items():
            props, tags = road["feature"]["properties"], road["feature"]["properties"]["osm_tags"]
            if scope == "study" and props["scope"] != "study_intersection":
                continue
            if scope == "download" and props["scope"] not in {"study_intersection", "download_buffer"}:
                continue
            if road_class and props["highway"] != road_class:
                continue
            if query and query not in road["search"]:
                continue
            is_area = "area" in road["flags"]
            if (geometry == "linear" and is_area) or (geometry == "area" and not is_area):
                continue
            if flag in {"missing_speed", "missing_access", "missing_name", "conditional", "area"} and flag not in road["flags"]:
                continue
            if flag == "oneway" and tags.get("oneway") not in {"yes", "1", "true", "-1"}:
                continue
            if flag == "bridge" and tags.get("bridge") in {None, "no", "false", "0"}:
                continue
            if flag == "steps" and tags.get("highway") != "steps":
                continue
            yield key, road

    def viewport(self, params):
        bbox = validate_bbox([float(x) for x in params["bbox"].split(",")])
        limit = max(1, min(int(params.get("limit", MAX_FEATURES)), MAX_FEATURES))
        features, total, listing = [], 0, []
        geometry = params.get("geometry", "area" if params.get("flag") == "area" else "linear")
        if geometry not in {"linear", "area", "all"}:
            raise ValueError("Bộ lọc hình học không hợp lệ")
        linear_total, area_total = 0, 0
        for key, road in self.filtered({**params, "geometry": "all"}):
            if not intersects(bbox, road["bbox"]):
                continue
            is_area = "area" in road["flags"]
            if is_area: area_total += 1
            else: linear_total += 1
            if (geometry == "linear" and is_area) or (geometry == "area" and not is_area):
                continue
            total += 1
            if len(features) < limit:
                props = road["feature"]["properties"]
                features.append({"type": "Feature", "geometry": road["feature"]["geometry"],
                                 "properties": {"id": key, "highway": props["highway"],
                                                "name": props.get("name"), "flags": road["flags"]}})
                if len(listing) < 60:
                    listing.append({"id": key, "name": props.get("name"), "highway": props["highway"]})
        barriers = [f for f in self.barriers.values() if point_in_box(f["geometry"]["coordinates"], bbox)]
        turns = [f for f in self.turn_points.values() if point_in_box(f["geometry"]["coordinates"], bbox)]
        return {"type": "FeatureCollection", "features": features, "total": total,
                "shown": len(features), "truncated": total > len(features), "listing": listing,
                "geometry": geometry, "linear_total": linear_total, "area_total": area_total,
                "barriers": {"type": "FeatureCollection", "features": barriers[:1000]},
                "turns": {"type": "FeatureCollection", "features": turns[:1000]},
                "barrier_total": len(barriers), "turn_total": len(turns)}

    def detail(self, kind, key):
        if kind == "way" and key in self.roads:
            road = self.roads[key]
            return {"kind": kind, "id": key, "tags": road["feature"]["properties"]["osm_tags"],
                    "feature": road["feature"], "flags": road["flags"], "members": [],
                    "related": [rel["id"] for rel in self.restrictions.values()
                                if any(m["type"] == "way" and m["ref"] == key for m in rel["members"])]}
        if kind == "node" and key in self.barriers:
            f = self.barriers[key]
            return {"kind": kind, "id": key, "tags": {k:v for k,v in f["properties"].items() if k != "osm_node_id"},
                    "feature": f, "flags": [], "members": []}
        if kind == "relation" and key in self.restrictions:
            rel = self.restrictions[key]
            lines = []
            for m in rel["members"]:
                if m["type"] == "way" and m["ref"] in self.roads:
                    road = self.roads[m["ref"]]["feature"]
                    lines.append({"type": "Feature", "geometry": road["geometry"],
                                  "properties": {"role": m["role"], "id": m["ref"]}})
            return {"kind": kind, "id": key, "tags": rel["tags"], "members": rel["members"], "flags": [],
                    "feature": self.turn_points.get(key), "member_lines": {"type": "FeatureCollection", "features": lines},
                    "simple_via_node_shape": rel["simple_via_node_shape"],
                    "members_complete": rel["members_complete"]}
        raise KeyError("Không tìm thấy phần tử trong snapshot")

    def samples(self):
        # Deterministic suggestions, NOT verified examples or random accuracy sample.
        chosen, used = [], set()
        def add(kind, key, label, coord):
            if (kind,key) not in used:
                used.add((kind,key)); chosen.append({"kind":kind,"id":key,"case":label,"coordinates":coord})
        groups = [("oneway", "Chiều một chiều"), ("steps", "Bậc thang"), ("bridge", "Cầu/tầng đường"),
                  ("conditional", "Thuộc tính có điều kiện"), ("missing_speed", "Thiếu thuộc tính tốc độ"),
                  ("missing_access", "Thiếu quyền đi tường minh")]
        for flag, label in groups:
            amount = 0
            for key, road in sorted(self.filtered({"scope":"study", "flag":flag})):
                if ("way",key) in used:
                    continue
                coords = road["feature"]["geometry"]["coordinates"]
                add("way",key,label,coords[len(coords)//2]); amount += 1
                if amount == 3: break
        for kind, source, label in [("relation",self.turn_points,"Hạn chế rẽ"), ("node",self.barriers,"Cổng/rào chắn")]:
            amount = 0
            for key, feature in sorted(source.items()):
                coord = feature["geometry"]["coordinates"]
                if point_in_box(coord,self.study):
                    add(kind,key,label,coord); amount += 1
                    if amount == 4: break
        return chosen


def make_handler(dataset):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            # Keep console readable; errors still reported to browser.
            if not str(args[1] if len(args)>1 else "").startswith("2"):
                super().log_message(fmt, *args)

        def respond(self, status, payload, content_type="application/json; charset=utf-8"):
            body = json.dumps(payload,ensure_ascii=False,allow_nan=False).encode() if isinstance(payload,(dict,list)) else payload
            # A browser can abort during either headers or body (e.g. fetch
            # cancellation on pan/reload). Windows raises ConnectionAbortedError
            # 10053 here. Never attempt a second HTTP response on that socket.
            try:
                self.send_response(status)
                self.send_header("Content-Type",content_type)
                self.send_header("Content-Length",str(len(body)))
                self.send_header("X-Content-Type-Options","nosniff")
                self.send_header("Referrer-Policy","strict-origin-when-cross-origin")
                self.send_header("Cache-Control","no-store" if content_type.startswith("application/json") else "no-cache")
                self.end_headers()
                self.wfile.write(body)
                return True
            except OSError:
                # This block only writes to the connection; file reads are
                # outside it and still generate a normal error response.
                self.close_connection = True
                return False

        def do_GET(self):
            host = urlsplit("//"+self.headers.get("Host", "")).hostname
            if host not in {"127.0.0.1","localhost"}:
                self.respond(403,{"message":"Chỉ truy cập bằng localhost hoặc 127.0.0.1"}); return
            url=urlsplit(self.path)
            params={k:v[-1] for k,v in parse_qs(url.query).items()}
            try:
                if url.path == "/api/info": self.respond(200,dataset.info())
                elif url.path == "/favicon.ico": self.respond(204,b"","image/x-icon")
                elif url.path == "/api/roads": self.respond(200,dataset.viewport(params))
                elif url.path == "/api/samples": self.respond(200,dataset.samples())
                elif url.path.startswith("/api/detail/"):
                    parts=url.path.split("/")
                    if len(parts)!=5: raise KeyError("Không có endpoint này")
                    self.respond(200,dataset.detail(parts[3],int(parts[4])))
                else:
                    allowed={"/":"index.html","/app.js":"app.js","/style.css":"style.css",
                             "/vendor/leaflet.js":"vendor/leaflet.js","/vendor/leaflet.css":"vendor/leaflet.css"}
                    if url.path not in allowed: raise KeyError("Không có file này")
                    file=STATIC/allowed[url.path]
                    mime="text/html" if file.suffix==".html" else "text/css" if file.suffix==".css" else "text/javascript"
                    self.respond(200,file.read_bytes(),mime+"; charset=utf-8")
            except (ValueError,IndexError) as exc: self.respond(400,{"message":str(exc)})
            except KeyError as exc: self.respond(404,{"message":str(exc)})
            except (BrokenPipeError,ConnectionResetError): pass
            except OSError: self.respond(500,{"message":"Không đọc được file giao diện"})
    return Handler


def main():
    parser=argparse.ArgumentParser(description="Xem khảo sát OSM trên localhost, không sửa dữ liệu")
    parser.add_argument("--snapshot",type=Path)
    parser.add_argument("--data-root",type=Path,default=Path("data/osm-survey"))
    parser.add_argument("--port",type=int,default=8765)
    args=parser.parse_args()
    try:
        if not 1024<=args.port<=65535: raise ValueError("Port phải từ 1024 đến 65535")
        snapshot=args.snapshot or auto_snapshot(args.data_root)
        print("Đang đọc snapshot:",snapshot.resolve(),flush=True)
        dataset=Dataset(snapshot)
        server=ThreadingHTTPServer(("127.0.0.1",args.port),make_handler(dataset))
        print(f"Mở http://localhost:{args.port} — Ctrl+C để dừng.",flush=True)
        print("Chỉ xem dữ liệu; phiếu rà soát lưu trong trình duyệt, cần xuất file để giữ lại.",flush=True)
        try: server.serve_forever()
        except KeyboardInterrupt: pass
        finally: server.server_close()
        return 0
    except (ValueError,KeyError,OSError) as exc:
        print("LỖI:",exc,file=sys.stderr); return 1


if __name__=="__main__": sys.exit(main())
