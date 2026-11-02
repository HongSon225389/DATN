import copy
import csv
import hashlib
import json
import io
from pathlib import Path
import tempfile
import unittest
import speed_basis_survey as s

class SpeedBasisTests(unittest.TestCase):
    def setUp(self):
        self.record=s.template('test',10,'missing_limit')
        self.at=s.tt.instant('2026-10-29T08:00:00+07:00')
    def bundle(self):return {'dataset_version':'test','records':[self.record]}
    def check(self):return s.validate_evidence(self.bundle(),'test',{10})
    def fixture(self,root):
        snap=root/'snapshot';snap.mkdir()
        elements=[{'type':'way','id':10,'nodes':[1,2],'tags':{'highway':'residential','lanes':'2'}},{'type':'way','id':20,'nodes':[2,3],'tags':{'highway':'primary','maxspeed':'50'}},{'type':'way','id':30,'nodes':[3,4],'tags':{'highway':'primary','maxspeed:forward':'20','maxspeed:backward':'30','maxspeed:conditional':'10 @ (07:00-09:00)'}}]
        raw=json.dumps({'elements':elements}).encode()
        (snap/'osm-raw.json').write_bytes(raw)
        (snap/'metadata.json').write_text(json.dumps({'status':'completed','dataset_version':'test','raw_sha256':hashlib.sha256(raw).hexdigest()}),encoding='utf-8')
        (snap/'roads.geojson').write_text(json.dumps({'features':[{'geometry':{'type':'LineString'},'properties':{'scope':'study_intersection','osm_way_id':e['id'],'osm_tags':e['tags']}} for e in elements]}),encoding='utf-8')
        return snap,raw
    def test_draft_has_no_invented_evidence(self):
        self.check();self.assertIsNone(self.record['proposed_limit_kmh']);self.assertEqual(self.record['sign_status'],'unknown')
    def test_snapshot_mismatch_rejected(self):
        self.record['dataset_version']='other'
        with self.assertRaises(ValueError):self.check()
    def test_duplicate_rejected(self):
        b=self.bundle();b['records'].append(copy.deepcopy(self.record))
        with self.assertRaises(ValueError):s.validate_evidence(b,'test',{10})
    def test_outside_way_and_invalid_profile_rejected(self):
        self.record['way_id']=99
        with self.assertRaises(ValueError):self.check()
        self.record['way_id']=10;self.record['profile']='truck'
        with self.assertRaises(ValueError):self.check()
    def test_bad_proposed_limit_rejected(self):
        for value in [0,-1,True,float('nan'),'50']:
            self.record['proposed_limit_kmh']=value
            with self.subTest(value=value),self.assertRaises(ValueError):self.check()
    def test_reviewed_requires_source_person_and_time(self):
        self.record['review_status']='reviewed'
        with self.assertRaises(ValueError):self.check()
        self.record.update(source_url='https://example.org/doc',reviewer='Test',checked_at='2026-10-29T08:00:00+07:00',notes='Schema test only')
        self.check()
    def test_comparing_osm_not_independent_verification(self):
        self.record['basis_kind']='osm_comparison'
        self.assertIn('no_independent_limit_basis',s.evidence_flags(self.record,self.at,50))
    def test_missing_tag_not_missing_sign(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);snap,_=self.fixture(root);run,_=s.audit(snap,root/'out',self.at)
            rows=list(csv.DictReader(io.StringIO((run/'speed-basis.csv').read_text(encoding='utf-8-sig'))))
            r=next(r for r in rows if r['way_id']=='10' and r['profile']=='car')
            self.assertEqual(r['limit_basis_state'],'unknown_missing');self.assertEqual(r['sign_presence'],'unknown');self.assertEqual(r['verified_legal_limit_kmh'],'')
    def test_directions_and_categories(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);snap,_=self.fixture(root);run,summary=s.audit(snap,root/'out',self.at)
            rows=list(csv.DictReader(io.StringIO((run/'speed-basis.csv').read_text(encoding='utf-8-sig'))))
            self.assertEqual(len(rows),18)
            vals={r['direction']:r['osm_limit_kmh'] for r in rows if r['way_id']=='30' and r['profile']=='car'}
            self.assertEqual(vals,{'forward':'','backward':''}) # multi-level conditional pending, not silently discarded
            self.assertEqual(next(r['count'] for r in summary if r['scope']=='sample_category' and r['metric']=='directional'),1)
    def test_general_context_missing_is_flagged(self):
        self.record['basis_kind']='general_rule'
        flags=s.evidence_flags(self.record,self.at,None)
        self.assertIn('general_rule_context_incomplete',flags);self.assertIn('absence_of_applicable_special_limit_not_established',flags)
    def test_conflict_and_expiry(self):
        self.record.update(proposed_limit_kmh=30,valid_until='2026-10-29T08:00:00+07:00')
        flags=s.evidence_flags(self.record,self.at,50)
        self.assertIn('expired',flags);self.assertIn('conflicts_with_osm_limit',flags)
    def test_manual_review_never_overrides_router(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);snap,raw=self.fixture(root)
            self.record.update(proposed_limit_kmh=40,review_status='reviewed',basis_kind='sign_document',sign_status='present',source_url='https://example.org/test',checked_at='2026-10-29T08:00:00+07:00',source_date='2026-10-28',reviewer='Test',notes='Not real evidence',applies_to_whole_way=True)
            ev=root/'evidence.json';ev.write_text(json.dumps(self.bundle()),encoding='utf-8')
            run,_=s.audit(snap,root/'out',self.at,ev)
            rows=list(csv.DictReader(io.StringIO((run/'speed-basis.csv').read_text(encoding='utf-8-sig'))))
            r=next(r for r in rows if r['way_id']=='10' and r['profile']=='car' and r['direction']=='forward')
            self.assertEqual(r['proposed_limit_kmh'],'40');self.assertEqual(r['manual_limit_applied'],'False');self.assertEqual(r['verified_legal_limit_kmh'],'')
            self.assertEqual((snap/'osm-raw.json').read_bytes(),raw)
    def test_self_declared_applied_rejected(self):
        self.record['applied_to_routing']=True
        with self.assertRaises(ValueError):self.check()
    def test_raw_hash_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);snap,raw=self.fixture(root);(snap/'osm-raw.json').write_bytes(raw+b' ')
            with self.assertRaises(ValueError):s.audit(snap,root/'out',self.at)
    def test_bad_time_and_validity_order(self):
        self.record['checked_at']='2026-10-29T08:00:00'
        with self.assertRaises(ValueError):self.check()
        self.record['checked_at']='';self.record.update(valid_from='2026-10-29T09:00:00+07:00',valid_until='2026-10-29T08:00:00+07:00')
        with self.assertRaises(ValueError):self.check()

if __name__=='__main__':unittest.main()
