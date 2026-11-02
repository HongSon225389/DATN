import copy,unittest
from types import SimpleNamespace
import edge_closure_scenario as sc
import historical_review as hr
import test_experimental_router as fixture
from experimental_router import Router
class ScenarioTests(unittest.TestCase):
 def setUp(self):
  self.g=fixture.ExperimentalRouterTests().graph([(10,2,3,10,10),(11,3,2,10,10),(20,1,2,10,10),(21,2,1,10,10),(30,3,4,10,10),(31,4,3,10,10),(40,1,5,30,30),(50,5,4,30,30)])
  for reverse,forward in [('11','10'),('21','20'),('31','30')]:self.g['edges'][reverse]['way_id']=self.g['edges'][forward]['way_id'];self.g['edges'][reverse]['direction']='backward'
  self.g['nodes']['n5']['lat']+=.001
  self.meta={'status':'completed','graph_version':'test','dataset_version':'d','raw_sha256':'h','evaluated_at':self.g['evaluated_at']}
  def feature(eid):
   e=self.g['edges'][eid];return {'type':'Feature','geometry':{'type':'LineString','coordinates':[[self.g['nodes'][e[k]]['lon'],self.g['nodes'][e[k]]['lat']] for k in ['graph_from','graph_to']]},'properties':copy.deepcopy(e)}
  self.r={'schema_version':'historical-spatial-review-0.1','graph_version':'test','dataset_version':'d','raw_sha256':'h','profile':'car','event_id':'e','event_date':'2025-09-30','review_status':'draft','applied_to_routing':False,'selected_edges':[feature('10'),feature('11')]}
 def build(self):return sc.build_scenario(self.r,self.meta,self.g,{'e'})
 def test_exact_two_and_immutable_draft_graph(self):
  a,b=copy.deepcopy(self.r),copy.deepcopy(self.g);d=self.build();o=sc.EdgeScenario(d,self.meta,self.g);self.assertEqual(set(o.for_graph(self.g)['blocked_edges']),{'10','11'});self.assertEqual(a,self.r);self.assertEqual(b,self.g)
 def test_single_edge_refused(self):
  self.r['selected_edges'].pop()
  with self.assertRaises(ValueError):self.build()
 def test_stale_graph_refused(self):
  d=self.build();d['graph_version']='other'
  with self.assertRaises(ValueError):sc.EdgeScenario(d,self.meta,self.g)
 def test_no_other_profile_closed(self):
  d=self.build();g=copy.deepcopy(self.g);g['profile']='motorcycle';self.assertFalse(sc.EdgeScenario(d,self.meta,self.g).for_graph(g)['blocked_edges'])
 def test_comparison_avoids_exact_source_ids(self):
  d=self.build();pair=d['test_pair'];r=sc.EdgeScenario(d,self.meta,self.g).compare(Router(self.g),pair['start'],pair['end'],start_edge=pair['start_edge'],end_edge=pair['end_edge'])
  self.assertEqual(r['baseline']['state'],'found');self.assertEqual(r['avoided']['state'],'found');self.assertGreater(r['avoided']['length_m'],r['baseline']['length_m'])
  sources={r['avoided'].get('partial_edges',{}).get(i,{}).get('source_edge_id',i) for i in r['avoided']['edge_ids']};self.assertFalse(sources&{'10','11'})
 def test_endpoint_on_closed_segment_not_relocated(self):
  d=self.build();pair=d['test_pair'];r=sc.EdgeScenario(d,self.meta,self.g).compare(Router(self.g),[105.8025,21],pair['end']);self.assertEqual(r['avoided']['state'],'endpoint_blocked_by_flood')
 def test_altered_geometry_rejected(self):
  d=self.build();d['selected_edges'][0]['geometry']['coordinates'][0][0]+=1
  with self.assertRaises(ValueError):sc.EdgeScenario(d,self.meta,self.g)
 def test_no_historical_promotion(self):
  d=self.build();self.assertEqual(d['data_mode'],'synthetic');self.assertEqual(self.r['review_status'],'draft');self.assertFalse(self.r['applied_to_routing'])
