import copy,unittest
from experimental_router import Router
import test_experimental_router as fixtures
class EdgeAttachmentTests(unittest.TestCase):
 def setUp(self):self.f=fixtures.ExperimentalRouterTests();self.g=self.f.graph()
 def point(self,n):return self.f.point(self.g,n)
 def between(self,a,b,t):return [x+(y-x)*t for x,y in zip(self.point(a),self.point(b))]
 def runroute(self,a,b,**kw):return Router(self.g).route_edges(a,b,max_snap_m=10,**kw)
 def test_same_edge_fractional_distance_time(self):
  r=self.runroute(self.between(1,2,.2),self.between(1,2,.8));self.assertEqual(r['state'],'found');self.assertAlmostEqual(r['length_m'],6,places=6);self.assertAlmostEqual(r['base_time_seconds'],6,places=6)
 def test_reverse_oneway_not_invented(self):self.assertEqual(self.runroute(self.between(1,2,.8),self.between(1,2,.2))['state'],'no_route')
 def test_midsegment_to_next_segment(self):
  r=self.runroute(self.between(1,2,.5),self.between(2,3,.5));self.assertAlmostEqual(r['length_m'],10)
 def test_endpoint_to_endpoint_no_extra_turn(self):self.assertAlmostEqual(self.runroute(self.point(1),self.point(3))['length_m'],20)
 def test_turn_restriction_retained_from_partial_start_to_partial_end(self):
  rec=self.f.record();rec['patterns']=[{'incoming':self.g['edges']['10'],'targets':[self.g['edges']['20']],'action':'no'}];self.g['turn_records']=[rec]
  self.assertEqual(self.runroute(self.between(1,2,.5),self.between(2,3,.5))['state'],'no_route')
 def test_local_pending_retained(self):
  rec=self.f.record('unresolved');rec['incoming_guards']=[self.g['edges']['10']];self.g['turn_records']=[rec]
  self.assertEqual(self.runroute(self.between(1,2,.5),self.between(2,3,.5),mode='diagnostic')['state'],'no_route')
 def test_via_way_partial_edges_preserve_full_raw_sequence(self):
  self.g=self.f.graph([(10,1,2,10,10),(20,2,3,10,10),(30,3,4,10,10)])
  rec=self.f.record();rec['sequence_patterns']=[{'action':'no','segments':[self.g['edges'][k] for k in ['10','20','30']]}];self.g['turn_records']=[rec]
  self.assertEqual(self.runroute(self.between(1,2,.5),self.between(3,4,.5))['state'],'no_route')
 def test_graph_not_mutated(self):
  before=copy.deepcopy(self.g);self.runroute(self.between(1,2,.2),self.between(2,3,.8));self.assertEqual(before,self.g)
 def test_offset_excluded_geometry_clipped(self):
  a=self.between(1,2,.2);b=self.between(1,2,.8);a[1]+=.00001
  r=self.runroute(a,b);self.assertAlmostEqual(r['length_m'],6,places=5);self.assertNotEqual(r['route']['geometry']['coordinates'][0],a);self.assertEqual(r['route']['geometry']['coordinates'][-1],b)
 def test_missing_time_edge_not_candidate(self):
  self.g['edges']['10']['base_time_seconds']=None
  self.assertEqual(self.runroute(self.between(1,2,.5),self.between(2,3,.5),weight='time')['state'],'snap_not_found')
 def test_no_automatic_reachable_fallback(self):
  self.g=self.f.graph([(10,1,2,10,10),(20,4,5,10,10)])
  r=self.runroute(self.between(1,2,.5),self.between(4,5,.5));self.assertEqual(r['state'],'no_route')
 def test_explicit_wrong_selection_rejected(self):
  with self.assertRaises(ValueError):self.runroute(self.point(1),self.point(3),end_edge='does-not-exist')
 def test_same_position(self):self.assertEqual(self.runroute(self.between(1,2,.5),self.between(1,2,.5))['state'],'same_attachment')
 def test_reverse_direction_available_when_present(self):
  self.g=self.f.graph([(10,1,2,10,10),(20,2,1,10,10)]);self.g['edges']['20']['way_id']=10;self.g['edges']['20']['direction']='backward'
  r=self.runroute(self.between(1,2,.8),self.between(1,2,.2));self.assertEqual(r['state'],'found');self.assertAlmostEqual(r['length_m'],6,places=5)
 def test_terminal_ports_do_not_reconnect(self):
  self.g['nodes']['n2']['terminal_port']=True
  self.assertEqual(self.runroute(self.point(2),self.point(3))['state'],'snap_not_found')
