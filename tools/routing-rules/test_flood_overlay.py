import copy,unittest
import flood_overlay as fo
import test_experimental_router as fixture
from experimental_router import Router
class FloodTests(unittest.TestCase):
 def setUp(self):
  self.f=fixture.ExperimentalRouterTests();self.g=self.f.graph([(10,1,2,10,10),(20,2,3,10,10),(30,1,4,30,30),(40,4,3,30,30)])
  # Place detour off the straight road.
  self.g['nodes']['n4']['lat']+=.001
  self.doc={'type':'FeatureCollection','data_mode':'synthetic','features':[{'type':'Feature','geometry':{'type':'Polygon','coordinates':[[[105.8014,20.9999],[105.8016,20.9999],[105.8016,21.0001],[105.8014,21.0001],[105.8014,20.9999]]]},'properties':{'event_id':'test','review_status':'approved','published':True,'status':'flooded','action':'block','profiles':['car','motorcycle','walking'],'observed_at':'2026-10-29T07:00:00+07:00','valid_from':'2026-10-29T07:00:00+07:00','valid_until':'2026-10-29T09:00:00+07:00','depth_cm':None}}]}
 def p(self):return self.doc['features'][0]['properties']
 def overlay(self):return fo.Overlay(self.doc).for_graph(self.g)
 def test_geometry_crossing_no_endpoint_inside(self):self.assertEqual(set(self.overlay()['blocked_edges']),{'10'})
 def test_detour_and_unchanged_source(self):
  before=copy.deepcopy(self.g);r=fo.Overlay(self.doc).compare(Router(self.g),self.f.point(self.g,1),self.f.point(self.g,3))
  self.assertEqual(r['baseline']['length_m'],20);self.assertEqual(r['avoided']['length_m'],60);self.assertEqual(before,self.g)
 def test_endpoint_not_resnapped_to_other_road(self):
  a=[105.8015,21.0];b=self.f.point(self.g,3);r=fo.Overlay(self.doc).compare(Router(self.g),a,b)
  self.assertEqual(r['avoided']['state'],'endpoint_blocked_by_flood')
 def test_expiry_not_dry(self):
  self.p()['valid_until']=self.g['evaluated_at'];r=self.overlay();self.assertFalse(r['blocked_edges']);self.assertIn('not_evidence_of_dryness',r['decisions'][0]['decision'])
 def test_start_time_inclusive(self):
  self.p()['valid_from']=self.g['evaluated_at'];self.assertTrue(self.overlay()['blocked_edges'])
 def test_future(self):
  self.p()['valid_from']='2026-10-29T08:30:00+07:00';self.assertFalse(self.overlay()['blocked_edges'])
 def test_unapproved_unpublished_not_used(self):
  self.p()['review_status']='pending';self.assertFalse(self.overlay()['blocked_edges']);self.p()['review_status']='approved';self.p()['published']=False;self.assertFalse(self.overlay()['blocked_edges'])
 def test_receded_unknown_no_passability_claim(self):
  for s in ['receded','unknown']:
   self.p()['status']=s;r=self.overlay();self.assertFalse(r['blocked_edges']);self.assertIn('requires_review',r['decisions'][0]['decision'])
 def test_profiles(self):
  self.p()['profiles']=['walking'];self.assertFalse(self.overlay()['blocked_edges'])
 def test_depth_not_passage_threshold(self):
  for value in [None,1,50]:self.p()['depth_cm']=value;self.assertTrue(self.overlay()['blocked_edges'])
 def test_bad_depth_rejected(self):
  self.p()['depth_cm']=-1
  with self.assertRaises(ValueError):self.overlay()
 def test_polygon_boundary(self):self.assertTrue(fo.hits([0,0],[2,0],[[1,0],[2,0],[2,1],[1,1],[1,0]]))
 def test_polygon_far(self):self.assertFalse(fo.hits([0,0],[.5,0],[[1,0],[2,0],[2,1],[1,1],[1,0]]))
 def test_self_intersection_rejected(self):
  with self.assertRaises(ValueError):fo.polygon({'type':'Polygon','coordinates':[[[0,0],[2,2],[0,2],[2,0],[0,0]]]})
 def test_no_automatic_point_buffer(self):
  self.doc['features'][0]['geometry']={'type':'Point','coordinates':[105.8,21]}
  with self.assertRaises(ValueError):self.overlay()
 def test_holes_rejected(self):
  self.doc['features'][0]['geometry']['coordinates']*=2
  with self.assertRaises(ValueError):self.overlay()
 def test_naive_time_rejected(self):
  self.p()['valid_until']='2026-10-29T09:00:00'
  with self.assertRaises(ValueError):self.overlay()
 def test_real_requires_source(self):
  self.doc['data_mode']='reviewed_public_sources'
  with self.assertRaises(ValueError):self.overlay()
 def test_coverage_not_opened(self):
  self.g['strict_coverage_complete']=False;r=fo.Overlay(self.doc).compare(Router(self.g),self.f.point(self.g,1),self.f.point(self.g,3));self.assertEqual(r['avoided']['state'],'coverage_incomplete')
 def test_overlapping_events_keep_all_ids(self):
  second=copy.deepcopy(self.doc['features'][0]);second['properties']['event_id']='second';self.doc['features'].append(second);self.assertEqual(self.overlay()['blocked_edges']['10'],['test','second'])

 def test_no_detour_available(self):
  del self.g['edges']['30'];del self.g['edges']['40']
  r=fo.Overlay(self.doc).compare(Router(self.g),self.f.point(self.g,1),self.f.point(self.g,3))
  self.assertEqual(r['avoided']['state'],'no_route')
 def test_both_directions_blocked(self):
  e=copy.deepcopy(self.g['edges']['10']);e.update(edge_id='reverse',graph_from='n2',graph_to='n1',from_node=2,to_node=1,direction='backward');self.g['edges']['reverse']=e
  self.assertEqual(set(self.overlay()['blocked_edges']),{'10','reverse'})
