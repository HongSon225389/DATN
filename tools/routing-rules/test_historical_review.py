import copy,json,tempfile,unittest
from pathlib import Path
import historical_review as hr
import test_experimental_router as fixtures
class HistoricalReviewTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.g=fixtures.ExperimentalRouterTests().graph()
  class Data:pass
  self.data=Data();self.data.graphs={'car':self.g};self.data.meta={'graph_version':'test','dataset_version':'dataset','raw_sha256':'hash','evaluated_at':self.g['evaluated_at']}
  self.doc={'sources':[{'source_id':'s','url':'https://example.org/source'}],'records':[{'event_id':'e','source_id':'s','applied_to_routing':False,'candidate_way_ids_by_name_only':[10,20],'candidate_graph_version':'test'}]}
  self.path=Path(self.temp.name)/'intake.json';self.path.write_text(json.dumps(self.doc))
  self.review=hr.HistoricalReview(self.data,self.path)
 def draft(self):return {'schema_version':'historical-spatial-review-0.1','event_id':'e','graph_version':'test','profile':'car','review_status':'draft','applied_to_routing':False,'selected_edges':[self.review.edge_feature('car','10')],'landmark':None,'landmark_source_url':'','footprint_evidence_url':''}
 def test_catalog_has_version_sources(self):self.assertEqual(self.review.catalog()['raw_sha256'],'hash');self.assertEqual(len(self.review.catalog()['records']),1)
 def test_candidates_directed_segments(self):
  r=self.review.candidates('e','car');self.assertEqual(r['total_matching_edges'],2);self.assertIsNotNone(r['bbox']);self.assertEqual(len(r['features'][0]['geometry']['coordinates']),2)
 def test_truncation_explicit(self):
  r=self.review.candidates('e','car',limit=1);self.assertEqual(r['returned_edges'],1);self.assertTrue(r['truncated']);self.assertEqual(r['total_matching_edges'],2)
 def test_stale_graph_refused(self):
  self.doc['records'][0]['candidate_graph_version']='old';self.path.write_text(json.dumps(self.doc));self.review=hr.HistoricalReview(self.data,self.path)
  with self.assertRaises(ValueError):self.review.candidates('e','car')
 def test_unknown_event_profile(self):
  with self.assertRaises(KeyError):self.review.candidates('bad','car')
  with self.assertRaises(ValueError):self.review.candidates('e','bad')
 def test_edge_lookup_not_limited_to_hints(self):
  self.assertEqual(self.review.edge_feature('car','20')['properties']['way_id'],20)
 def test_draft_valid(self):self.assertTrue(hr.validate_draft(self.draft(),self.g,{'e'}))
 def test_graph_not_mutated(self):
  before=copy.deepcopy(self.g);self.review.candidates('e','car');hr.validate_draft(self.draft(),self.g,{'e'});self.assertEqual(before,self.g)
 def test_changed_geometry_refused(self):
  d=self.draft();d['selected_edges'][0]['geometry']['coordinates'][0][0]+=1
  with self.assertRaises(ValueError):hr.validate_draft(d,self.g,{'e'})
 def test_duplicate_edge_refused(self):
  d=self.draft();d['selected_edges']*=2
  with self.assertRaises(ValueError):hr.validate_draft(d,self.g,{'e'})
 def test_no_publishing_or_automatic_routing(self):
  for key,value in [('applied_to_routing',True),('review_status','approved'),('graph_version','old')]:
   d=self.draft();d[key]=value
   with self.assertRaises(ValueError):hr.validate_draft(d,self.g,{'e'})
 def test_landmark_and_https_validation(self):
  for key,value in [('landmark',[999,21]),('landmark_source_url','javascript:bad')]:
   d=self.draft();d[key]=value
   with self.assertRaises(ValueError):hr.validate_draft(d,self.g,{'e'})
