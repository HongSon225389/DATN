#!/usr/bin/env python3
"""Read-only localhost graph inspection server, fixed static allowlist."""
import argparse
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
from pathlib import Path
import sys
from urllib.parse import parse_qs,urlsplit
from inspect_graph import Dataset
from experimental_router import Router
import threading

STATIC=Path(__file__).with_name('graph-viewer')

def handler_for(data):
    routers={}
    route_lock=threading.Lock()
    class Handler(BaseHTTPRequestHandler):
        def respond(self,status,payload,mime='application/json; charset=utf-8'):
            body=payload if isinstance(payload,bytes) else json.dumps(payload,ensure_ascii=False,allow_nan=False).encode('utf-8')
            try:
                self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','strict-origin-when-cross-origin');self.end_headers();self.wfile.write(body)
            except OSError:self.close_connection=True
        def do_GET(self):
            url=urlsplit(self.path);q=parse_qs(url.query);one=lambda k,default:q.get(k,[default])[0]
            if self.headers.get('Host','') not in {f'localhost:{self.server.server_port}',f'127.0.0.1:{self.server.server_port}'}:
                self.respond(403,{'message':'Chỉ localhost'});return
            try:
                profile=one('profile','car');weight=one('weight','distance');kind=one('kind','wcc')
                if url.path=='/api/route':
                    if profile not in data.graphs:raise ValueError('Phương tiện không hợp lệ')
                    if not route_lock.acquire(blocking=False):
                        self.respond(429,{'message':'Đang tính tuyến khác, thử lại sau'});return
                    try:
                        if profile not in routers:routers[profile]=Router(data.graphs[profile])
                        args=([float(v) for v in one('start','').split(',')],[float(v) for v in one('end','').split(',')],weight,one('mode','strict'),float(one('max_snap','100')))
                        options={'start_edge':one('start_edge',None),'end_edge':one('end_edge',None)}
                        if one('avoid_flood','false') not in {'true','false'}:raise ValueError('avoid_flood không hợp lệ')
                        if one('avoid_flood','false')=='true':
                            if getattr(data,'flood',None) is None:raise ValueError('Chưa nạp vùng ngập')
                            comparison=data.flood.compare(routers[profile],*args,**options)
                            result={**comparison['avoided'],'baseline':comparison['baseline'],'flood_overlay':comparison['overlay'],'distance_delta_m':comparison['distance_delta_m']}
                        else:result=routers[profile].route_edges(*args,**options)
                        self.respond(200,result)
                    finally:route_lock.release()
                elif url.path=='/api/review':
                    review=getattr(data,'review',None)
                    self.respond(200,review.catalog() if review else {'records':[],'sources':[],'notice':'Chưa nạp hồ sơ rà soát'})
                elif url.path=='/api/review-edge':
                    review=getattr(data,'review',None)
                    if review is None:raise ValueError('Chưa nạp hồ sơ rà soát')
                    self.respond(200,review.edge_feature(profile,one('edge','')))
                elif url.path=='/api/review-candidates':
                    review=getattr(data,'review',None)
                    if review is None:raise ValueError('Chưa nạp hồ sơ rà soát')
                    self.respond(200,review.candidates(one('event',''),profile))
                elif url.path=='/api/flood':
                    overlay=getattr(data,'flood',None)
                    self.respond(200,overlay.for_graph(data.graphs[profile]) if overlay else {'data_mode':'not_loaded','blocked_edges':{},'active_regions':{'type':'FeatureCollection','features':[]}})
                elif url.path=='/api/info':self.respond(200,data.info(profile,weight,kind))
                elif url.path=='/api/viewport':self.respond(200,data.viewport(profile,weight,kind,[float(n) for n in one('bbox','').split(',')],int(one('component','0'))))
                elif url.path=='/api/detail':self.respond(200,data.detail(profile,one('edge','')))
                elif url.path=='/favicon.ico':self.respond(204,b'','image/x-icon')
                elif url.path in {'/','/app.js','/style.css','/vendor/leaflet.js','/vendor/leaflet.css','/review.js'}:
                    name='index.html' if url.path=='/' else url.path[1:]
                    mime='text/html; charset=utf-8' if name.endswith('.html') else 'text/css' if name.endswith('.css') else 'text/javascript; charset=utf-8'
                    self.respond(200,(STATIC/name).read_bytes(),mime)
                else:self.respond(404,{'message':'Không có tài nguyên'})
            except KeyError:self.respond(404,{'message':'Không có đối tượng'})
            except (ValueError,TypeError) as exc:self.respond(400,{'message':str(exc) if url.path.startswith('/api/review') else 'Tham số không hợp lệ'})
            except OSError:self.respond(500,{'message':'Không đọc được giao diện'})
    return Handler

def main():
    p=argparse.ArgumentParser(description='Kiểm tra graph và Dijkstra thử nghiệm tại localhost')
    p.add_argument('--edge-scenario',type=Path);p.add_argument('--evidence',type=Path,default=Path(__file__).with_name('historical-evidence')/'intake-20250930.json');p.add_argument('--flood',type=Path);p.add_argument('--graph',type=Path,required=True);p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--port',type=int,default=8766)
    a=p.parse_args()
    try:
        if not 1<=a.port<=65535:raise ValueError('Port không hợp lệ')
        print('Đang đọc graph và tính thành phần liên thông...',flush=True);data=Dataset(a.graph,a.snapshot)
        if a.evidence.is_file():
            from historical_review import HistoricalReview
            data.review=HistoricalReview(data,a.evidence)
        if a.flood and a.edge_scenario:raise ValueError('Chọn một lớp: --flood hoặc --edge-scenario')
        if a.edge_scenario:
            from edge_closure_scenario import EdgeScenario
            scenario=json.loads(a.edge_scenario.read_text(encoding='utf-8-sig'))
            data.flood=EdgeScenario(scenario,data.meta,data.graphs[scenario['profile']])
            print('GIẢ LẬP — chặn đúng hai cạnh từ phiếu; không xác nhận ngập thật',flush=True)
        if a.flood:
            from flood_overlay import Overlay
            data.flood=Overlay(json.loads(a.flood.read_text(encoding='utf-8-sig')))
            print('Vùng ngập:',data.flood.document['data_mode'],'— đánh giá tại thời điểm graph',flush=True)
        server=ThreadingHTTPServer(('127.0.0.1',a.port),handler_for(data));print(f'Mở http://localhost:{a.port} — Ctrl+C để dừng. Có Dijkstra thử nghiệm; không thay coverage.',flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:server.server_close()
        return 0
    except (OSError,ValueError,KeyError,TypeError) as exc:print('LỖI:',exc,file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
