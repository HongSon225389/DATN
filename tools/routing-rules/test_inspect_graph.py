import copy
from http.client import HTTPConnection
from pathlib import Path
import tempfile
import threading
import unittest
import build_graph as bg
import inspect_graph as ig
import graph_viewer as gv

class GraphInspectionTests(unittest.TestCase):
    def graph(self):
        ns={f'n{i}':{'osm_node_id':i,'lon':105.8+i*.001,'lat':21.,'terminal_port':False} for i in range(1,6)}
        es={}
        for eid,a,b in [('a',1,2),('b',2,1),('c',2,3),('d',4,5)]:
            es[eid]={'edge_id':eid,'way_id':10,'direction':'forward','name':'<script>test</script>','graph_from':f'n{a}','graph_to':f'n{b}','base_time_seconds':None if eid=='d' else 1}
        return {'nodes':ns,'edges':es,'profile':'car','graph_version':'test','node_controls':{},'turn_records':[],'summary':{},'strict_coverage_complete':True}
    def dataset(self):
        d=ig.Dataset.__new__(ig.Dataset);d.meta={'graph_version':'test','dataset_version':'test'};d.graphs={};d.maps={};d.components=[];d.pending=[];d.elements={}
        for profile in ['car','motorcycle','walking']:
            g=self.graph();g['profile']=profile;d.graphs[profile]=g
            for w in ['distance','time']:
                maps,rows=ig.memberships(g,w);d.maps[profile,w]=maps;d.components+=rows
        return d
    def test_component_counts_and_members(self):
        maps,rows=ig.memberships(self.graph())
        self.assertEqual(sum(r['kind']=='wcc' for r in rows),2);self.assertEqual(sum(r['kind']=='scc' for r in rows),4)
        self.assertEqual(maps['wcc']['n1'],maps['wcc']['n3']);self.assertNotEqual(maps['scc']['n1'],maps['scc']['n3'])
    def test_time_drops_missing_cost_component(self):
        maps,rows=ig.memberships(self.graph(),'time');self.assertNotIn('n4',maps['wcc']);self.assertEqual(len(maps['wcc']),3)
    def test_deterministic_ranking_and_empty(self):
        a=ig.memberships(self.graph());b=ig.memberships(self.graph());self.assertEqual(a,b)
        self.assertEqual(ig.memberships({'profile':'car','nodes':{},'edges':{}}),({'wcc':{},'scc':{}},[]))
    def test_bounding_boxes_and_component_edge_counts(self):
        _,rows=ig.memberships(self.graph());r=next(r for r in rows if r['kind']=='wcc' and r['component_id']==1)
        self.assertEqual(r['node_count'],3);self.assertEqual(r['internal_directed_edges'],3);self.assertEqual(r['boundary_incident_edges'],0)
    def test_viewport_truncation_explicit(self):
        d=self.dataset();r=d.viewport('car','distance','wcc',[105,20,106,22],limit=1)
        self.assertEqual(r['total_matching_edges'],4);self.assertTrue(r['truncated']);self.assertEqual(len(r['features']),1)
    def test_component_filter_and_crossing_segment(self):
        d=self.dataset();r=d.viewport('car','distance','wcc',[105.8014,20.99,105.8016,21.01],1)
        self.assertEqual(r['total_matching_edges'],2)
        r=d.viewport('car','distance','wcc',[105,20,106,22],2);self.assertEqual(r['total_matching_edges'],1)
    def test_bad_bbox_and_filters(self):
        d=self.dataset()
        for bbox in [[106,20,105,22],[float('nan'),20,106,22],[105,20,106]]:
            with self.assertRaises(ValueError):d.viewport('car','distance','wcc',bbox)
        with self.assertRaises(ValueError):d.info('truck')
    def test_detail_and_no_mutation(self):
        d=self.dataset();old=copy.deepcopy(d.graphs);self.assertEqual(d.detail('car','a')['name'],'<script>test</script>')
        d.info('car');d.viewport('car','distance','scc',[105,20,106,22]);self.assertEqual(old,d.graphs)
    def test_blocked_nodes_not_component_filtered(self):
        d=self.dataset();d.graphs['car']['node_controls']={'99':{'blocked':True,'state':'unresolved','reason':'gate'}};d.elements['node',99]={'lon':105.85,'lat':21}
        r=d.viewport('car','distance','wcc',[105,20,106,22],2);self.assertEqual(len(r['blocked_nodes']),1)
    def test_export_and_coverage_unchanged(self):
        d=self.dataset();d.run=Path('fake');old=copy.deepcopy(d.graphs)
        with tempfile.TemporaryDirectory() as tmp:
            run=d.export(Path(tmp));meta=bg.read_json(run/'metadata.json');self.assertFalse(meta['coverage_changed']);self.assertEqual(bg.read_json(run/'car.component-membership.json.gz')['distance']['wcc'],d.maps['car','distance']['wcc'])
        self.assertEqual(old,d.graphs)
    def test_http_allowlist_and_bad_host(self):
        server=gv.ThreadingHTTPServer(('127.0.0.1',0),gv.handler_for(self.dataset()));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            conn=HTTPConnection('127.0.0.1',server.server_port,timeout=5)
            for path,code in [('/api/info',200),('/api/viewport?bbox=105,20,106,22',200),('/api/viewport?bbox=bad',400),('/api/detail?edge=none',404),('/../build_graph.py',404)]:
                conn.request('GET',path);r=conn.getresponse();self.assertEqual(r.status,code);r.read()
            conn.request('GET','/api/info',headers={'Host':'evil.example'});r=conn.getresponse();self.assertEqual(r.status,403);r.read();conn.close()
        finally:server.shutdown();server.server_close();thread.join()
    def persisted_fixture(self,root):
        run=root/'graph';run.mkdir();snap=root/'snapshot';snap.mkdir()
        raw=b'{"elements":[]}'
        (snap/'osm-raw.json').write_bytes(raw);bg.write_json(snap/'metadata.json',{'dataset_version':'test'})
        hashes={}
        for profile,graph in self.dataset().graphs.items():
            name=profile+'.graph.json.gz';bg.write_json(run/name,graph);hashes[name]=ig.hashlib.sha256((run/name).read_bytes()).hexdigest()
        bg.write_json(run/'metadata.json',{'status':'completed','graph_version':'test','dataset_version':'test','raw_sha256':ig.hashlib.sha256(raw).hexdigest(),'output_sha256':hashes})
        return run,snap
    def test_constructor_verifies_graph_and_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            run,snap=self.persisted_fixture(Path(tmp));data=ig.Dataset(run,snap)
            self.assertEqual(len(data.graphs),3)
            (run/'car.graph.json.gz').write_bytes(b'bad')
            with self.assertRaises(ValueError):ig.Dataset(run,snap)
    def test_wrong_snapshot_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            run,snap=self.persisted_fixture(Path(tmp));(snap/'osm-raw.json').write_bytes(b'{"elements":[]} ')
            with self.assertRaises(ValueError):ig.Dataset(run,snap)
    def test_socket_disconnect_does_not_send_second_error(self):
        class Fake:
            def send_response(self,*a):raise ConnectionAbortedError()
        fake=Fake();fake.close_connection=False
        gv.handler_for(self.dataset()).respond(fake,200,{'ok':True});self.assertTrue(fake.close_connection)

if __name__=='__main__':unittest.main()
