import copy
import math
import unittest
import experimental_router as r
import turn_rules as tr
import build_graph as bg

class ExperimentalRouterTests(unittest.TestCase):
    def graph(self,links=None):
        links=links or [(10,1,2,10,10),(20,2,3,10,10)]
        nodes={f'n{i}':{'osm_node_id':i,'lon':105.8+i*.001,'lat':21.0,'terminal_port':False,'snap_eligible':True} for i in range(1,7)}
        edges={};adj={}
        for wid,a,b,length,seconds in links:
            seg=tr.segment(wid,0,'forward',[a,b]);eid=str(wid)
            edges[eid]={**seg,'edge_id':eid,'graph_from':f'n{a}','graph_to':f'n{b}','length_m':length,'base_time_seconds':seconds,'limit_status':'missing','speed_assumed':True}
            adj.setdefault(f'n{a}',[]).append(eid)
        return {'graph_version':'test','profile':'car','evaluated_at':'2026-10-29T08:00:00+07:00','strict_coverage_complete':True,'unlocated_pending_turn_relations':[],'nodes':nodes,'edges':edges,'adjacency':adj,'turn_records':[]}
    def point(self,g,n):return [g['nodes'][f'n{n}']['lon'],g['nodes'][f'n{n}']['lat']]
    def route(self,g,a=1,b=3,**kw):return r.Router(g).route(self.point(g,a),self.point(g,b),**kw)
    def record(self,status='ready'):
        return {'relation_id':100,'profile':'car','status':status,'patterns':[],'sequence_patterns':[],'incoming_guards':[]}
    def test_distance_and_time_choose_different_routes(self):
        g=self.graph([(10,1,2,10,20),(20,2,3,10,20),(30,1,3,30,5)])
        self.assertEqual(self.route(g)['edge_ids'],['10','20']);self.assertEqual(self.route(g,weight='time')['edge_ids'],['30'])
    def test_oneway_no_reverse_created(self):
        self.assertEqual(self.route(self.graph(),a=3,b=1,max_snap_m=20)['state'],'snap_not_found')
    def test_strict_coverage_refuses_even_when_path_exists(self):
        g=self.graph();g['strict_coverage_complete']=False;g['unlocated_pending_turn_relations']=[999]
        self.assertEqual(self.route(g)['state'],'coverage_incomplete')
        x=self.route(g,mode='diagnostic');self.assertEqual(x['state'],'found');self.assertFalse(x['coverage_complete']);self.assertIn(999,x['unlocated_pending_relations'])
    def test_local_pending_not_bypassed_diagnostic(self):
        g=self.graph();rec=self.record('unresolved');rec['incoming_guards']=[g['edges']['10']];g['turn_records']=[rec]
        self.assertEqual(self.route(g,mode='diagnostic')['state'],'no_route')
    def test_static_no_turn(self):
        g=self.graph();rec=self.record();rec['patterns']=[{'incoming':g['edges']['10'],'targets':[g['edges']['20']],'action':'no'}];g['turn_records']=[rec]
        self.assertEqual(self.route(g)['state'],'no_route')
    def test_static_only_turn(self):
        g=self.graph([(10,1,2,10,10),(20,2,3,10,10),(30,2,4,5,5),(40,4,3,5,5)])
        rec=self.record();rec['patterns']=[{'incoming':g['edges']['10'],'targets':[g['edges']['20']],'action':'only'}];g['turn_records']=[rec]
        self.assertEqual(self.route(g)['edge_ids'],['10','20'])
    def test_via_way_requires_history_state_not_node_only(self):
        g=self.graph([(10,1,2,1,1),(20,2,3,1,1),(30,3,4,1,1),(40,1,5,2,2),(50,5,2,2,2)])
        rec=self.record();rec['sequence_patterns']=[{'action':'no','segments':[g['edges'][k] for k in ['10','20','30']]}];g['turn_records']=[rec]
        x=self.route(g,b=4);self.assertEqual(x['state'],'found');self.assertEqual(x['edge_ids'],['40','50','20','30']);self.assertEqual(x['total_cost'],6)
    def test_only_via_way_blocks_early_exit(self):
        g=self.graph([(10,1,2,1,1),(20,2,3,1,1),(30,3,4,1,1),(40,2,4,1,1)])
        rec=self.record();rec['sequence_patterns']=[{'action':'only','segments':[g['edges'][k] for k in ['10','20','30']]}];g['turn_records']=[rec]
        self.assertEqual(self.route(g,b=4)['edge_ids'],['10','20','30'])
    def test_same_snapped_node_not_fake_route(self):
        g=self.graph();x=self.route(g,a=2,b=2);self.assertEqual(x['state'],'same_snapped_node');self.assertIsNone(x['route'])
    def test_snap_distance_bound_and_no_connector_in_geojson(self):
        g=self.graph();router=r.Router(g);a=self.point(g,1);a[1]+=0.00001
        x=router.route(a,self.point(g,3));self.assertEqual(x['state'],'found');self.assertNotEqual(x['route']['geometry']['coordinates'][0],a);self.assertGreater(x['snapped_start']['offset_m'],0)
        self.assertEqual(router.route([0,0],self.point(g,3))['state'],'snap_not_found')
    def test_terminal_port_never_snapped(self):
        g=self.graph();g['nodes']['n1']['terminal_port']=True;g['nodes']['n1']['snap_eligible']=False
        self.assertEqual(self.route(g,max_snap_m=10)['state'],'snap_not_found')
    def test_time_missing_cost_not_used(self):
        g=self.graph([(10,1,2,1,None),(20,2,3,1,1),(30,1,3,10,10)])
        self.assertEqual(self.route(g,weight='time')['edge_ids'],['30']);self.assertIsNone(self.route(g)['base_time_seconds'])
    def test_disconnected_graph_exhaustion(self):
        g=self.graph([(10,1,2,1,1),(20,4,3,1,1)]);x=self.route(g);self.assertEqual(x['state'],'no_route');self.assertEqual(x['no_route_reason'],'different_weak_components_after_graph_filters');self.assertEqual(x['expanded_states'],0)
    def test_search_limit_distinct_no_route(self):
        self.assertEqual(self.route(self.graph(),max_states=1)['state'],'search_limit')
    def test_invalid_inputs_and_cost(self):
        for point in [[float('nan'),21],[200,21],[105],['105',21]]:
            with self.assertRaises(ValueError):r.coordinate(point)
        g=self.graph();g['edges']['10']['length_m']=-1
        with self.assertRaises(ValueError):r.Router(g)
        with self.assertRaises(ValueError):self.route(self.graph(),max_snap_m=1000)
    def test_inputs_unchanged_and_frozen_time_recorded(self):
        g=self.graph();old=copy.deepcopy(g);x=self.route(g);self.assertEqual(g,old);self.assertEqual(x['evaluated_at'],g['evaluated_at']);self.assertTrue(x['route']['properties']['research_only'])
    def test_indexed_guard_matches_full_machine(self):
        g=self.graph();rec=self.record();rec['patterns']=[{'incoming':g['edges']['10'],'targets':[g['edges']['20']],'action':'no'}];g['turn_records']=[rec]
        router=r.Router(g);self.assertEqual(router.check(['10'],g['edges']['20']),r.vw.RestrictionMachine([rec],'car').advance([g['edges']['10']],g['edges']['20'])['state'])
    def test_history_only_retains_active_via_prefix(self):
        g=self.graph([(10,1,2,1,1),(20,2,3,1,1),(30,3,4,1,1),(40,1,5,2,2),(50,5,2,2,2)])
        rec=self.record();rec['sequence_patterns']=[{'action':'no','segments':[g['edges'][k] for k in ['10','20','30']]}];g['turn_records']=[rec]
        router=r.Router(g);self.assertEqual(router.compact_history(('10','20')),('10','20'));self.assertEqual(router.compact_history(('40','50','20')),('20',))
    def test_overlapping_prefixes_keep_longest_suffix(self):
        g=self.graph([(10,1,2,1,1),(20,2,3,1,1),(30,3,4,1,1),(40,4,5,1,1)])
        rec=self.record();rec['sequence_patterns']=[{'action':'no','segments':[g['edges'][k] for k in ['10','20','30']]},{'action':'no','segments':[g['edges'][k] for k in ['20','30','40']]}];g['turn_records']=[rec]
        router=r.Router(g);self.assertEqual(router.compact_history(('10','20')),('10','20'));self.assertEqual(router.compact_history(('10','20','30')),('20','30'))
        self.assertEqual(router.check(('20','30'),g['edges']['40']),'forbidden')
    def test_barrier_split_ports_prevent_through_path(self):
        ar,_=bg.ar.load_rules();dr,_=bg.dr.load_rules();cfg,_=bg.bs.load_config()
        es={('node',i):{'id':i,'type':'node','lon':105.8+i*.001,'lat':21,'tags':{'barrier':'gate'} if i==2 else {}} for i in [1,2,3]}
        way={'type':'way','id':10,'nodes':[1,2,3],'tags':{'highway':'residential'}};es['way',10]=way
        graph,_=bg.build_profile({10:way},es,'car',cfg,ar,dr,[],'2026-10-29T08:00:00+07:00')
        self.assertEqual(self.route(graph,max_snap_m=10)['state'],'no_route')

if __name__=='__main__':unittest.main()
