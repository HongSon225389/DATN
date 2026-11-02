import copy
from datetime import datetime
import json
from pathlib import Path
import tempfile
import unittest
import time_turn_rules as t
import turn_rules as tr

class TimeTurnTests(unittest.TestCase):
    def setUp(self):
        self.rules,_=tr.load_rules()
        self.elements={('node',n):{'type':'node','id':n} for n in [1,2,3]}
        for wid,nodes in [(10,[1,2]),(20,[2,3])]:
            self.elements['way',wid]={'type':'way','id':wid,'nodes':nodes}
        self.rel={'type':'relation','id':99,'tags':{'type':'restriction','restriction:conditional':'no_left_turn @ (Mo-Fr 07:00-09:00,16:00-19:00)'},'members':[{'type':'way','ref':10,'role':'from'},{'type':'node','ref':2,'role':'via'},{'type':'way','ref':20,'role':'to'}]}
    def norm(self, at='2026-10-29T08:00:00+07:00', profile='car'):
        return t.normalize_at(self.rel,profile,self.elements,self.rules,at)
    def test_window_boundaries(self):
        for time,expected in [('06:59:59',False),('07:00:00',True),('08:59:59',True),('09:00:00',False),('16:00:00',True),('19:00:00',False)]:
            self.assertEqual(t.schedule('07:00-09:00,16:00-19:00',f'2026-10-29T{time}+07:00'),expected)
    def test_weekday_and_weekend(self):
        self.assertEqual(self.norm()['status'],'ready')
        self.assertEqual(self.norm('2026-10-31T08:00:00+07:00')['status'],'inactive_at_time')
    def test_day_list_and_wrap(self):
        self.assertTrue(t.schedule('Fr-Mo 00:00-24:00','2026-11-01T12:00:00+07:00'))
        self.assertFalse(t.schedule('Mo,We,Fr 00:00-24:00','2026-10-29T12:00:00+07:00'))
    def test_overnight_uses_previous_day(self):
        self.assertTrue(t.schedule('Fr 22:00-02:00','2026-10-31T01:00:00+07:00'))
        self.assertFalse(t.schedule('Fr 22:00-02:00','2026-10-30T01:00:00+07:00'))
        self.assertFalse(t.schedule('Fr 22:00-02:00','2026-10-31T02:00:00+07:00'))
    def test_timezone_and_naive_rejected(self):
        self.assertEqual(self.norm('2026-10-29T01:00:00Z')['status'],'ready')
        with self.assertRaises(ValueError):self.norm('2026-10-29T08:00:00')
    def test_bad_or_unsupported_schedules(self):
        for text in ['Mo-Fr;PH off','PH 07:00-09:00','Mo-Fr 25:00-26:00','07:00-07:00','07:00-09:00;16:00-18:00','wet','Mo-Fr 07:00-09:00 AND wet','Jan-Mar 07:00-09:00','24:00-02:00','07:00-24:01']:
            with self.subTest(text=text),self.assertRaises(ValueError):t.schedule(text,'2026-10-29T08:00:00+07:00')
    def test_unsupported_tail_never_partially_evaluated(self):
        self.rel['tags']['restriction:conditional']='no_left_turn @ (07:00-09:00); no_right_turn @ (16:00-18:00)'
        self.assertEqual(self.norm()['status'],'unresolved')
    def test_base_rule_restored_outside_window(self):
        self.rel['tags']['restriction']='no_right_turn'
        r=self.norm('2026-10-29T12:00:00+07:00')
        self.assertEqual(r['status'],'ready');self.assertEqual(r['effective_value'],'no_right_turn')
    def test_raw_source_unchanged(self):
        original=copy.deepcopy(self.rel);r=self.norm()
        self.assertEqual(self.rel,original);self.assertEqual(r['tags'],original['tags'])
    def test_exemption_and_walking(self):
        self.rel['tags']['except']='motorcycle'
        self.assertEqual(self.norm(profile='motorcycle')['status'],'exempt')
        self.assertEqual(self.norm(profile='walking')['status'],'not_applicable')
    def test_bad_except_still_pending(self):
        self.rel['tags']['except']='motorcyle'
        self.assertEqual(self.norm()['status'],'unresolved')
    def test_via_way_not_silently_supported(self):
        self.rel['members'][1]={'type':'way','ref':20,'role':'via'}
        self.assertEqual(self.norm()['status'],'unresolved')
        self.assertEqual(self.norm('2026-10-29T12:00:00+07:00')['status'],'unresolved')
    def test_invalid_structure_even_outside_window(self):
        self.rel['members'].pop()
        self.assertEqual(self.norm('2026-10-29T12:00:00+07:00')['status'],'invalid')
    def test_conflicting_only_rules(self):
        self.rel['tags']['restriction:conditional']='only_left_turn @ (07:00-09:00)'
        other=copy.deepcopy(self.rel);other['id']=100;other['members'][-1]['ref']=30
        self.elements['way',30]={'type':'way','id':30,'nodes':[2,1]}
        rs=t.evaluate_at([self.rel,other],self.elements,self.rules,'2026-10-29T08:00:00+07:00')
        self.assertTrue(all(r['status']=='unresolved' for r in rs if r['profile']=='car'))
    def test_active_blocks_transition(self):
        r=self.norm();a=tr.segment(10,0,'forward',[1,2]);b=tr.segment(20,0,'forward',[2,3])
        self.assertEqual(tr.evaluate_transition([r],'car',a,b)['state'],'forbidden')
    def test_specific_key_and_other_mode(self):
        self.rel['tags']['restriction:taxi:conditional']='no_right_turn @ (PH)'
        self.assertEqual(self.norm()['status'],'ready')
        self.rel['tags']['restriction:motorcar']='no_right_turn'
        self.assertEqual(self.norm()['status'],'unresolved')
    def test_audit_metadata_and_hash(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);snap=base/'snapshot';snap.mkdir()
            raw=json.dumps({'elements':[*self.elements.values(),self.rel]}).encode()
            (snap/'osm-raw.json').write_bytes(raw)
            (snap/'metadata.json').write_text(json.dumps({'status':'completed','dataset_version':'test','raw_sha256':hashlib.sha256(raw).hexdigest()}),encoding='utf-8')
            run,_=t.audit(snap,base/'out','2026-10-29T08:00:00+07:00')
            meta=json.loads((run/'metadata.json').read_text(encoding='utf-8'))
            self.assertFalse(meta['time_dependent_routing']);self.assertEqual(meta['profile_decision_count'],3)
            self.assertEqual((snap/'osm-raw.json').read_bytes(),raw)
            (snap/'osm-raw.json').write_bytes(raw+b' ')
            with self.assertRaises(ValueError):t.audit(snap,base/'out','2026-10-29T08:00:00+07:00')

if __name__=='__main__':unittest.main()
