import copy
import json
from pathlib import Path
import tempfile
import unittest

import turn_diagnostics as td
import turn_rules as tr


class DiagnosticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.rules,_=tr.load_rules()
    def setUp(self):
        self.elements={('node',i):{'type':'node','id':i} for i in [1,2,3]}
        self.elements['way',10]={'type':'way','id':10,'nodes':[1,2]}
        self.elements['way',20]={'type':'way','id':20,'nodes':[2,3]}
        self.rel={'type':'relation','id':100,'tags':{'type':'restriction','restriction':'no_left_turn'},
                  'members':[{'type':'way','ref':10,'role':'from'},
                             {'type':'node','ref':2,'role':'via'},{'type':'way','ref':20,'role':'to'}]}
    def diagnose(self):
        record=tr.normalize(self.rel,'car',self.elements,self.rules)
        before=copy.deepcopy(record)
        result=td.diagnose(record,self.elements,self.rules)
        self.assertEqual(record,before)
        return result
    def test_primary_group_and_overlapping_issues_are_separate(self):
        self.rel['tags']['restriction:conditional']='no_left_turn @ (07:00-09:00)'
        self.rel['members'][1]={'type':'way','ref':20,'role':'via'}
        d=self.diagnose()
        self.assertEqual(d['primary_group'],'conditional_time')
        self.assertIn('via_way_single',d['findings'])
        self.assertIn('has_relevant_conditional',d['findings'])
    def test_inline_condition_is_distinct(self):
        self.rel['tags']['restriction']='no_left_turn @ (07:00-09:00)'
        self.assertEqual(self.diagnose()['primary_group'],'inline_condition')
    def test_comma_and_typo_reported_without_fixing(self):
        self.rel['tags']['except']='motorcycle,bicycle'
        self.assertIn('except_comma_separator',self.diagnose()['findings'])
        self.rel['tags']['except']='motorcyle;bicycle'
        d=self.diagnose()
        self.assertEqual(d['except_raw'],'motorcyle;bicycle')
        self.assertIn('except_possible_motorcycle_typo',d['findings'])
    def test_missing_roles_are_explicit(self):
        self.rel['members']=self.rel['members'][:1]
        d=self.diagnose()
        self.assertEqual(d['primary_group'],'member_shape')
        self.assertIn('missing_role_via',d['findings']);self.assertIn('missing_role_to',d['findings'])
    def test_schedule_shape_is_not_evaluation(self):
        self.assertEqual(td.conditional_shape('no_left_turn @ (06:00-09:00,16:00-19:30)'),
                         'daily_time_shape_not_evaluated')
        self.assertEqual(td.conditional_shape('no_left_turn @ (Mo-Fr 07:00-09:00)'),
                         'weekday_or_holiday_shape_not_evaluated')
        self.assertEqual(td.conditional_shape('not a rule'),'other_or_malformed')
    def create_snapshot(self,root):
        snapshot=root/'snapshot';snapshot.mkdir()
        self.rel['tags']['restriction:conditional']='no_left_turn @ (07:00-09:00)'
        (snapshot/'osm-raw.json').write_text(json.dumps({'elements':[*self.elements.values(),self.rel]}))
        (snapshot/'metadata.json').write_text(json.dumps({'status':'completed','dataset_version':'synthetic-test'}))
        turn_result,_=tr.audit(snapshot,root/'turn')
        return snapshot,turn_result
    def test_integration_counts_unique_relations_and_preserves_inputs(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);snapshot,result=self.create_snapshot(root)
            p=result/'turn-rules.normalized.json';before=p.read_bytes()
            run,summary,meta=td.analyze(snapshot,result,root/'diagnostics')
            self.assertEqual(p.read_bytes(),before)
            self.assertEqual(meta['pending_decision_count'],2)
            self.assertEqual(meta['unique_pending_relations'],1)
            self.assertFalse(meta['changed_source_or_rules'])
            self.assertEqual(sum(r['decision_count'] for r in summary),2)
            self.assertTrue((run/'groups'/'conditional_time.csv').is_file())
    def test_wrong_snapshot_hash_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);snapshot,result=self.create_snapshot(root)
            p=snapshot/'osm-raw.json';p.write_text(p.read_text(encoding='utf-8')+' ', encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'hash'):td.analyze(snapshot,result,root/'diagnostics')
    def test_duplicate_decisions_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);snapshot,result=self.create_snapshot(root)
            p=result/'turn-rules.normalized.json';records=json.loads(p.read_text(encoding='utf-8'));records.append(records[0])
            p.write_text(json.dumps(records), encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'thiếu/trùng'):td.analyze(snapshot,result,root/'diagnostics')
    def test_changed_tags_in_result_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);snapshot,result=self.create_snapshot(root)
            p=result/'turn-rules.normalized.json';records=json.loads(p.read_text(encoding='utf-8'));records[0]['tags']['except']='motorcar'
            p.write_text(json.dumps(records), encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'Tags/members'):td.analyze(snapshot,result,root/'diagnostics')


if __name__=='__main__':unittest.main()
