from http.client import HTTPConnection
import json
import threading
import unittest
from urllib.parse import urlencode
import graph_viewer as gv
import test_experimental_router as router_tests

class RouteHttpTests(unittest.TestCase):
    def setUp(self):
        helper=router_tests.ExperimentalRouterTests();self.g=helper.graph();self.a=helper.point(self.g,1);self.b=helper.point(self.g,3)
        class Data:pass
        data=Data();data.graphs={'car':self.g};self.data=data
        self.server=gv.ThreadingHTTPServer(('127.0.0.1',0),gv.handler_for(data));self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
    def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join()
    def request(self,**params):
        query={'profile':'car','start':','.join(map(str,self.a)),'end':','.join(map(str,self.b)),**params}
        c=HTTPConnection('127.0.0.1',self.server.server_port,timeout=5)
        try:c.request('GET','/api/route?'+urlencode(query));r=c.getresponse();return r.status,json.loads(r.read())
        finally:c.close()
    def test_route_api_returns_geojson(self):
        status,data=self.request();self.assertEqual(status,200);self.assertEqual(data['state'],'found');self.assertEqual(data['route']['geometry']['type'],'LineString')
    def test_schedule_api_estimates_without_changing_route(self):
        _,base=self.request()
        status,r=self.request(schedule_mode='arrive_by',schedule_at='2026-10-29T09:00:00+07:00')
        self.assertEqual(status,200);self.assertEqual(r['edge_ids'],base['edge_ids'])
        self.assertEqual(r['schedule']['state'],'estimated')
        self.assertFalse(r['schedule']['time_dependent_routing'])
        self.assertEqual(self.request(schedule_mode='depart_at',schedule_at='2026-10-29T08:00')[0],400)
    def test_edge_attachment_and_explicit_selection(self):
        status,data=self.request(start_edge='10',end_edge='20')
        self.assertEqual(status,200);self.assertEqual(data['attachment_method'],'edge_projection')
        self.assertTrue(data['end_candidates']);self.assertEqual(data['snapped_end']['way_id'],20)
        self.assertEqual(self.request(end_edge='unknown')[0],400)
    def test_flood_api_returns_comparison(self):
        import flood_overlay as fo
        import test_flood_overlay as fixtures
        sample=fixtures.FloodTests();sample.setUp();self.data.flood=fo.Overlay(sample.doc)
        status,r=self.request(avoid_flood='true')
        self.assertEqual(status,200);self.assertEqual(r['baseline']['state'],'found')
        self.assertEqual(r['state'],'no_route');self.assertIn('10',r['flood_overlay']['blocked_edges'])
        self.assertIn('10',self.g['edges'])
    def test_avoid_without_loaded_overlay_is_error(self):
        self.assertEqual(self.request(avoid_flood='true')[0],400)
    def test_review_endpoints_read_only(self):
        import historical_review as hr
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'intake.json'
            self.data.meta={'graph_version':'test','dataset_version':'dataset','raw_sha256':'hash','evaluated_at':self.g['evaluated_at']}
            path.write_text(json.dumps({'sources':[{'source_id':'s'}],'records':[{'event_id':'e','source_id':'s','applied_to_routing':False,'candidate_way_ids_by_name_only':[10],'candidate_graph_version':'test'}]}))
            self.data.review=hr.HistoricalReview(self.data,path)
            for url in ['/api/review','/api/review-candidates?event=e&profile=car','/api/review-edge?edge=10&profile=car','/review.js']:
                c=HTTPConnection('127.0.0.1',self.server.server_port,timeout=5)
                try:c.request('GET',url);res=c.getresponse();self.assertEqual(res.status,200);self.assertTrue(res.read())
                finally:c.close()
            c=HTTPConnection('127.0.0.1',self.server.server_port,timeout=5)
            try:c.request('POST','/api/review',body='{}');res=c.getresponse();self.assertEqual(res.status,501);res.read()
            finally:c.close()
    def test_explicit_diagnostic_and_bad_inputs(self):
        self.g['strict_coverage_complete']=False;self.g['unlocated_pending_turn_relations']=[999]
        self.assertEqual(self.request()[1]['state'],'coverage_incomplete')
        self.assertEqual(self.request(mode='diagnostic')[1]['state'],'found')
        self.assertEqual(self.request(mode='bad')[0],400);self.assertEqual(self.request(start='nan,21')[0],400)

if __name__=='__main__':unittest.main()
