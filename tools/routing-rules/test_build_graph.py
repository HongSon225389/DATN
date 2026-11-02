import copy
import json
from pathlib import Path
import tempfile
import unittest
import build_graph as g

class GraphTests(unittest.TestCase):
    def setUp(self):
        self.ar,_=g.ar.load_rules();self.dr,_=g.dr.load_rules();self.config,_=g.bs.load_config();self.rules,_=g.tr.load_rules();self.at='2026-10-29T08:00:00+07:00'
        self.es={('node',i):{'type':'node','id':i,'lon':105.8+i*0.001,'lat':21.0,'tags':{}} for i in range(1,8)}
        self.ways={10:{'type':'way','id':10,'nodes':[1,2,3],'tags':{'highway':'residential'}},20:{'type':'way','id':20,'nodes':[3,4],'tags':{'highway':'residential'}}}
        self.es.update({('way',i):w for i,w in self.ways.items()})
    def graph(self,p='car',turns=None):return g.build_profile(self.ways,self.es,p,self.config,self.ar,self.dr,turns or [],self.at)[0]
    def test_directed_segments_and_reverse(self):
        x=self.graph();self.assertEqual(len(x['edges']),6);self.assertEqual(len(x['nodes']),4)
        a=x['edges']['10:0:forward'];b=x['edges']['10:0:backward'];self.assertEqual(a['from_node'],b['to_node']);self.assertAlmostEqual(a['length_m'],b['length_m']);self.assertGreater(a['base_time_seconds'],0)
    def test_oneway_and_motorcycle_exception(self):
        self.ways[10]['tags'].update(oneway='yes',**{'oneway:motorcycle':'no'})
        self.assertNotIn('10:0:backward',self.graph()['edges']);self.assertIn('10:0:backward',self.graph('motorcycle')['edges'])
    def test_denial_private_and_specific_override(self):
        self.ways[10]['tags']['access']='private';self.assertNotIn('10:0:forward',self.graph()['edges'])
        self.ways[10]['tags']['motorcar']='yes';self.assertIn('10:0:forward',self.graph()['edges'])
    def test_pending_access_and_dimension_exclude(self):
        self.ways[10]['tags']['motorcar:conditional']='yes @ wet';self.assertNotIn('10:0:forward',self.graph()['edges'])
        self.ways[10]['tags'].pop('motorcar:conditional');self.ways[10]['tags']['maxwidth']='1.5'
        self.assertNotIn('10:0:forward',self.graph()['edges']);self.assertIn('10:0:forward',self.graph('motorcycle')['edges'])
    def test_unknown_gate_splits_ports_no_through(self):
        self.es['node',2]['tags']={'barrier':'gate'};x=self.graph();a=x['edges']['10:0:forward'];b=x['edges']['10:1:forward']
        self.assertNotEqual(a['graph_to'],b['graph_from']);self.assertEqual(a['to_node'],b['from_node'])
        self.assertEqual(g.GraphTransitions(x).advance(['10:0:forward'],'10:1:forward')['state'],'invalid_transition')
        self.assertFalse(x['nodes'][a['graph_to']]['snap_eligible'])
    def test_accepted_gate_keeps_node(self):
        self.es['node',2]['tags']={'barrier':'gate','access':'yes','locked':'no'}
        self.assertEqual(self.graph()['edges']['10:0:forward']['graph_to'],'n2')
    def test_node_access_without_barrier_not_ignored(self):
        self.es['node',2]['tags']={'motorcar':'no'}
        self.assertTrue(self.graph()['nodes']['b2:10:0']['terminal_port'])
    def test_shape_barrier_flags_coverage(self):
        self.es['way',50]={'type':'way','id':50,'nodes':[2,5],'tags':{'barrier':'wall'}}
        x=self.graph();self.assertFalse(x['strict_coverage_complete']);self.assertEqual(len(x['unsupported_shape_barriers']),1)
        self.assertEqual(g.GraphTransitions(x).advance([],'10:0:forward')['state'],'coverage_incomplete')
    def test_unknown_speed_distance_but_not_time(self):
        self.ways[10]['tags']['maxspeed']='signals';x=self.graph();self.assertIsNone(x['edges']['10:0:forward']['base_time_seconds'])
        self.assertEqual(g.GraphTransitions(x).advance([],'10:0:forward','time')['state'],'missing_time_cost')
        self.assertEqual(g.GraphTransitions(x).advance([],'10:0:forward')['state'],'not_blocked_by_evaluated_rules')
    def relation(self):
        return {'type':'relation','id':100,'tags':{'type':'restriction','restriction':'no_left_turn'},'members':[{'type':'way','ref':10,'role':'from'},{'type':'node','ref':3,'role':'via'},{'type':'way','ref':20,'role':'to'}]}
    def test_static_turn_guard(self):
        rel=self.relation();records=g.vw.evaluate_at([rel],self.es,self.rules,self.at);x=self.graph(turns=records)
        self.assertEqual(g.GraphTransitions(x).advance(['10:1:forward'],'20:0:forward')['state'],'forbidden')
    def test_local_pending_turn_guard(self):
        rel=self.relation();rel['tags']['restriction:conditional']='no_left_turn @ (PH)'
        x=self.graph(turns=g.vw.evaluate_at([rel],self.es,self.rules,self.at))
        self.assertTrue(x['strict_coverage_complete']);self.assertEqual(g.GraphTransitions(x).advance(['10:1:forward'],'20:0:forward')['state'],'unresolved')
    def test_unlocated_pending_disables_strict(self):
        rel=self.relation();rel['members']=[m for m in rel['members'] if m['role']!='via']
        x=self.graph(turns=g.vw.evaluate_at([rel],self.es,self.rules,self.at))
        self.assertFalse(x['strict_coverage_complete']);self.assertEqual(g.GraphTransitions(x).advance([],'10:0:forward')['state'],'coverage_incomplete')
    def test_via_way_history_preserved(self):
        self.ways[10]['nodes']=[1,2];self.ways[15]={'type':'way','id':15,'nodes':[2,3],'tags':{'highway':'residential'}};self.es['way',15]=self.ways[15]
        rel=self.relation();rel['members'][1]={'type':'way','role':'via','ref':15}
        x=self.graph(turns=g.vw.evaluate_at([rel],self.es,self.rules,self.at));guard=g.GraphTransitions(x)
        a=guard.advance([],'10:0:forward');b=guard.advance(a['next_edge_history'],'15:0:forward')
        self.assertEqual(guard.advance(b['next_edge_history'],'20:0:forward')['state'],'forbidden')
        self.assertEqual(guard.advance([],'20:0:forward')['state'],'not_blocked_by_evaluated_rules')
    def test_same_coordinates_different_nodes_not_merged(self):
        self.es['node',5]['lon']=self.es['node',3]['lon'];self.es['node',5]['lat']=self.es['node',3]['lat'];self.ways[20]['nodes']=[5,4]
        x=self.graph();self.assertEqual(x['summary']['distance_topology']['weak_components'],2)
    def test_parallel_edges_preserved(self):
        self.ways[30]={'type':'way','id':30,'nodes':[3,4],'tags':{'highway':'residential'}};self.es['way',30]=self.ways[30]
        self.assertIn('30:0:forward',self.graph()['edges']);self.assertIn('20:0:forward',self.graph()['edges'])
    def test_component_counts_known_graph(self):
        x=self.graph();s=x['summary']['distance_topology'];self.assertEqual(s['weak_components'],1);self.assertEqual(s['strong_components'],1)
        for w in self.ways.values():w['tags']['oneway']='yes'
        s=self.graph()['summary']['distance_topology'];self.assertEqual(s['weak_components'],1);self.assertEqual(s['strong_components'],4)
    def test_degenerate_segment_rejected(self):
        self.ways[10]['nodes']=[1,1,2]
        self.assertNotIn('10:0:forward',self.graph()['edges'])
    def test_empty_graph(self):
        for w in self.ways.values():w['tags']['access']='no'
        x=self.graph();self.assertFalse(x['edges']);self.assertEqual(x['summary']['distance_topology']['weak_components'],0)
    def fixture(self,root):
        snap=root/'snapshot';snap.mkdir();raw=json.dumps({'elements':list(self.es.values())}).encode()
        (snap/'osm-raw.json').write_bytes(raw);g.write_json(snap/'metadata.json',{'status':'completed','dataset_version':'test','raw_sha256':g.hashlib.sha256(raw).hexdigest()})
        features=[{'geometry':{'type':'LineString','coordinates':[[self.es['node',n]['lon'],self.es['node',n]['lat']] for n in w['nodes']]},'properties':{'osm_way_id':wid,'osm_tags':w['tags'],'scope':'study_intersection'}} for wid,w in self.ways.items()]
        g.write_json(snap/'roads.geojson',{'features':features});return snap,features
    def test_node_order_mismatch_fails(self):
        with tempfile.TemporaryDirectory() as temp:
            snap,features=self.fixture(Path(temp));features[0]['geometry']['coordinates'].reverse()
            with self.assertRaises(ValueError):g.select_ways(features,self.es,'study')
    def test_snapshot_hash_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);snap,_=self.fixture(root);(snap/'osm-raw.json').write_bytes(b'{}')
            with self.assertRaises(ValueError):g.build(snap,root/'out',self.at)
    def test_build_roundtrip_version_and_source(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);snap,_=self.fixture(root);old=(snap/'osm-raw.json').read_bytes()
            run,rows=g.build(snap,root/'out',self.at);run2,_=g.build(snap,root/'out',self.at)
            a=g.read_json(run/'car.graph.json.gz');b=g.read_json(run2/'car.graph.json.gz')
            self.assertEqual(a,b);self.assertEqual((snap/'osm-raw.json').read_bytes(),old);self.assertEqual(len(rows),3)
            meta=g.read_json(run/'metadata.json');self.assertTrue(meta['graph_created']);self.assertFalse(meta['router_implemented'])
            self.assertEqual(len(a['edges']),6)
    def test_time_change_versions_graph(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);snap,_=self.fixture(root)
            a,_=g.build(snap,root/'out',self.at);b,_=g.build(snap,root/'out','2026-10-29T12:00:00+07:00')
            self.assertNotEqual(g.read_json(a/'metadata.json')['graph_version'],g.read_json(b/'metadata.json')['graph_version'])
    def test_policy_and_all_output_hashes_saved(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);snap,_=self.fixture(root);run,_=g.build(snap,root/'out',self.at)
            meta=g.read_json(run/'metadata.json');self.assertEqual(meta['status'],'completed')
            for name,digest in meta['output_sha256'].items():self.assertEqual(g.hashlib.sha256((run/name).read_bytes()).hexdigest(),digest)
            self.assertIn('barrier-speed-rules.v1.json',meta['output_sha256'])
    def test_profile_networks_remain_distinct(self):
        self.ways[10]['tags']['highway']='footway'
        self.assertNotIn('10:0:forward',self.graph()['edges']);self.assertIn('10:0:forward',self.graph('walking')['edges'])
    def test_inputs_unchanged(self):
        old=copy.deepcopy(self.es);self.graph();self.assertEqual(old,self.es)

if __name__=='__main__':unittest.main()
