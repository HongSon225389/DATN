import contextlib
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from unittest.mock import Mock

import survey
import viewer


class ViewerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        root=Path(cls.temp.name)
        fixture=Path(__file__).parent/'examples'/'synthetic-fixture.json'
        with contextlib.redirect_stdout(io.StringIO()):
            assert survey.main(['--input',str(fixture),'--output',str(root)])==0
        cls.snapshot=viewer.auto_snapshot(root)
        cls.dataset=viewer.Dataset(cls.snapshot)

    @classmethod
    def tearDownClass(cls): cls.temp.cleanup()

    def test_snapshot_and_metadata(self):
        self.assertTrue(self.dataset.info()['synthetic'])
        self.assertEqual(self.dataset.info()['restriction_count'],3)

    def test_filter_missing_speed_accounts_for_conditional_speed(self):
        ids={key for key,_ in self.dataset.filtered({'flag':'missing_speed','geometry':'all'})}
        self.assertNotIn(104,ids)
        self.assertIn(106,ids)
        ids={key for key,_ in self.dataset.filtered({'flag':'conditional'})}
        self.assertIn(104,ids)

    def test_scope_keeps_dependencies_separate(self):
        self.assertNotIn(107,{key for key,_ in self.dataset.filtered({'scope':'study'})})
        self.assertIn(107,{key for key,_ in self.dataset.filtered({'scope':'all'})})

    def test_viewport_explicit_truncation_and_no_tags_bulk(self):
        data=self.dataset.viewport({'bbox':'105.8,20.99,105.85,21.04','limit':'1'})
        self.assertTrue(data['truncated'])
        self.assertEqual(data['shown'],1)
        self.assertNotIn('osm_tags',data['features'][0]['properties'])
        self.assertEqual(len(data['barriers']['features']),1)

    def test_geometry_defaults_to_linear_and_reports_area_separately(self):
        data=self.dataset.viewport({'bbox':'105.8,20.99,105.85,21.04'})
        self.assertEqual((data['total'],data['linear_total'],data['area_total']),(4,4,1))
        self.assertNotIn(106,{f['properties']['id'] for f in data['features']})
        data=self.dataset.viewport({'bbox':'105.8,20.99,105.85,21.04','geometry':'all'})
        self.assertEqual(data['total'],5)

    def test_area_filter_can_explicitly_select_area_ways(self):
        data=self.dataset.viewport({'bbox':'105.8,20.99,105.85,21.04','geometry':'area'})
        self.assertEqual([f['properties']['id'] for f in data['features']],[106])
        with self.assertRaises(ValueError):list(self.dataset.filtered({'geometry':'bad'}))
        with self.assertRaises(ValueError):self.dataset.viewport({'bbox':'105.8,20.99,105.85,21.04','geometry':'bad'})

    def test_detail_preserves_turn_exceptions_and_way_tags(self):
        d=self.dataset.detail('way',101)
        self.assertEqual(d['tags']['name'],'Đường thử, không có thực')
        self.assertIn(201,d['related'])
        d=self.dataset.detail('relation',201)
        self.assertEqual(d['tags']['except'],'foot')
        self.assertEqual(d['feature']['properties']['location_method'],'via_node')
        self.assertEqual(len(d['member_lines']['features']),2)

    def test_complex_via_way_is_labeled_representative(self):
        d=self.dataset.detail('relation',202)
        self.assertEqual(d['feature']['properties']['location_method'],'via_way_representative')

    def test_samples_are_unique_and_not_claimed_verified(self):
        samples=self.dataset.samples()
        self.assertEqual(len(samples),len({(s['kind'],s['id']) for s in samples}))
        self.assertTrue(all('verified' not in s for s in samples))

    def test_invalid_filter_bbox_and_missing_detail(self):
        with self.assertRaises(ValueError):list(self.dataset.filtered({'flag':'nonsense'}))
        with self.assertRaises(ValueError):self.dataset.viewport({'bbox':'nan,0,2,2'})
        with self.assertRaises(KeyError):self.dataset.detail('way',999)

    def test_local_http_serves_only_allowlist(self):
        server=viewer.ThreadingHTTPServer(('127.0.0.1',0),viewer.make_handler(self.dataset))
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base='http://127.0.0.1:'+str(server.server_port)
        try:
            with urllib.request.urlopen(base+'/api/info') as r:
                self.assertEqual(r.status,200)
                self.assertEqual(r.headers['Referrer-Policy'],'strict-origin-when-cross-origin')
                self.assertTrue(json.load(r)['synthetic'])
            with urllib.request.urlopen(base+'/') as r:self.assertIn('Khảo sát mạng đường',r.read().decode())
            with urllib.request.urlopen(base+'/favicon.ico') as r:
                self.assertEqual(r.status,204)
                self.assertEqual(r.read(),b'')
            for path in ['/../../survey.py','/metadata.json','/api/detail/way/999']:
                with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(base+path)
                self.assertEqual(e.exception.code,404)
            req=urllib.request.Request(base+'/api/info',headers={'Host':'unexpected.example'})
            with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(req)
            self.assertEqual(e.exception.code,403)
        finally:
            server.shutdown();server.server_close();thread.join(timeout=2)

    def test_disconnected_socket_during_headers_or_body_does_not_send_500(self):
        cls=viewer.make_handler(self.dataset)
        for phase in ['headers','body']:
            for failure in [ConnectionAbortedError(10053,'Windows connection aborted'),
                            ConnectionResetError(10054,'reset'), BrokenPipeError('pipe'),
                            TimeoutError('socket timeout')]:
                with self.subTest(phase=phase,failure=type(failure).__name__):
                    handler=object.__new__(cls)
                    handler.headers={'Host':'localhost:8765'}
                    handler.path='/api/roads?bbox=105.8,20.99,105.85,21.04'
                    handler.send_response=Mock()
                    handler.send_header=Mock()
                    handler.end_headers=Mock(side_effect=failure if phase=='headers' else None)
                    handler.wfile=Mock()
                    if phase=='body':handler.wfile.write.side_effect=failure
                    handler.close_connection=False
                    handler.do_GET()
                    handler.send_response.assert_called_once_with(200)
                    self.assertTrue(handler.close_connection)

    def test_error_response_is_safe_if_connection_already_aborted(self):
        cls=viewer.make_handler(self.dataset)
        handler=object.__new__(cls)
        handler.headers={'Host':'localhost:8765'}
        handler.path='/api/detail/way/999'
        handler.send_response=Mock()
        handler.send_header=Mock()
        handler.end_headers=Mock(side_effect=ConnectionAbortedError(10053,'aborted'))
        handler.wfile=Mock()
        handler.do_GET()
        handler.send_response.assert_called_once_with(404)
        self.assertTrue(handler.close_connection)


if __name__=='__main__':unittest.main()
