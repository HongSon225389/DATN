import copy
import json
from pathlib import Path
import tempfile
import unittest

import turn_rules as tr


class TurnTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.rules,_=tr.load_rules()
    def setUp(self):
        self.elements={('node',n):{'type':'node','id':n} for n in [1,2,3,4]}
        for key,nodes in [(10,[1,2]),(20,[2,3]),(30,[2,4])]:
            self.elements['way',key]={'type':'way','id':key,'nodes':nodes}
        self.rel={'type':'relation','id':100,'tags':{'type':'restriction','restriction':'no_left_turn'},
                  'members':[{'type':'way','ref':10,'role':'from'},
                             {'type':'node','ref':2,'role':'via'},{'type':'way','ref':20,'role':'to'}]}
        self.inc=tr.segment(10,0,'forward',[1,2]);self.out=tr.segment(20,0,'forward',[2,3])
        self.other=tr.segment(30,0,'forward',[2,4])
    def norm(self,profile='car'):return tr.normalize(self.rel,profile,self.elements,self.rules)
    def test_no_blocks_only_matched_transition(self):
        r=self.norm();self.assertEqual(r['status'],'ready')
        self.assertEqual(tr.evaluate_transition([r],'car',self.inc,self.out)['state'],'forbidden')
        self.assertEqual(tr.evaluate_transition([r],'car',self.inc,self.other)['state'],'not_blocked_by_evaluated_rules')
    def test_only_blocks_other_exits_not_target(self):
        self.rel['tags']['restriction']='only_right_turn';r=self.norm()
        self.assertEqual(tr.evaluate_transition([r],'car',self.inc,self.other)['state'],'forbidden')
        self.assertEqual(tr.evaluate_transition([r],'car',self.inc,self.out)['state'],'not_blocked_by_evaluated_rules')
    def test_only_applies_after_correct_incoming(self):
        self.rel['tags']['restriction']='only_right_turn';r=self.norm()
        inc=tr.segment(30,0,'backward',[2,4])
        self.assertEqual(tr.evaluate_transition([r],'car',inc,self.out)['state'],'not_blocked_by_evaluated_rules')
    def test_same_way_no_u_turn_preserves_straight_through(self):
        self.elements['way',10]['nodes']=[1,2,3]
        self.rel['members'][-1]['ref']=10;self.rel['tags']['restriction']='no_u_turn'
        r=self.norm();straight=tr.segment(10,1,'forward',[1,2,3])
        self.assertEqual(r['status'],'ready')
        self.assertEqual(tr.evaluate_transition([r],'car',self.inc,tr.reverse_segment(self.inc))['state'],'forbidden')
        self.assertEqual(tr.evaluate_transition([r],'car',self.inc,straight)['state'],'not_blocked_by_evaluated_rules')
    def test_same_way_only_u_turn_blocks_straight(self):
        self.elements['way',10]['nodes']=[1,2,3]
        self.rel['members'][-1]['ref']=10;self.rel['tags']['restriction']='only_u_turn'
        r=self.norm();straight=tr.segment(10,1,'forward',[1,2,3])
        self.assertEqual(tr.evaluate_transition([r],'car',self.inc,straight)['state'],'forbidden')
        self.assertEqual(tr.evaluate_transition([r],'car',self.inc,tr.reverse_segment(self.inc))['state'],'not_blocked_by_evaluated_rules')
    def test_except_exact_mode_and_parent(self):
        self.rel['tags']['except']='bicycle;moped;motorcycle'
        self.assertEqual(self.norm('motorcycle')['status'],'exempt')
        self.assertEqual(self.norm('car')['status'],'ready')
        self.rel['tags']['except']='motor_vehicle'
        self.assertEqual(self.norm('car')['status'],'exempt')
    def test_moped_exception_not_motorcycle(self):
        self.rel['tags']['except']='moped;bicycle'
        self.assertEqual(self.norm('motorcycle')['status'],'ready')
    def test_car_exception_real_example(self):
        self.rel['tags']['except']='bicycle;moped;motorcar;motorcycle'
        self.assertEqual(self.norm('car')['status'],'exempt')
        self.assertEqual(self.norm('motorcycle')['status'],'exempt')
    def test_walking_does_not_inherit_generic_restriction(self):
        self.assertEqual(self.norm('walking')['status'],'not_applicable')
    def test_specific_foot_rule_is_supported(self):
        self.rel['tags']['restriction:foot']='no_left_turn'
        self.assertEqual(self.norm('walking')['status'],'ready')
    def test_other_vehicle_only_rule_not_applied_to_car(self):
        self.rel['tags']={'type':'restriction','restriction:bus':'no_left_turn'}
        self.assertEqual(self.norm('car')['status'],'not_applicable')
    def test_specific_mode_overrides_generic_value(self):
        self.rel['tags']['restriction:motorcar']='only_right_turn'
        r=self.norm();self.assertEqual(r['rule_key'],'restriction:motorcar')
        self.assertEqual(r['patterns'][0]['action'],'only')
    def test_specific_rule_conflicting_except_is_unresolved(self):
        self.rel['tags'].update({'restriction:motorcar':'no_left_turn','except':'motorcar'})
        self.assertEqual(self.norm()['status'],'unresolved')
    def test_conditional_kept_pending_and_local_guard(self):
        self.rel['tags']['restriction:conditional']='no_left_turn @ (07:00-09:00)'
        r=self.norm();self.assertEqual(r['status'],'unresolved')
        self.assertEqual(tr.evaluate_transition([r],'car',self.inc,self.out)['state'],'unresolved')
    def test_except_can_exempt_generic_conditional(self):
        self.rel['tags'].update({'restriction:conditional':'no_left_turn @ (07:00-09:00)','except':'motorcycle'})
        self.assertEqual(self.norm('motorcycle')['status'],'exempt')
    def test_unrelated_taxi_conditional_does_not_hold_car_rule(self):
        self.rel['tags']['restriction:taxi:conditional']='no_left_turn @ (07:00-09:00)'
        self.assertEqual(self.norm()['status'],'ready')
    def test_malformed_except_does_not_silently_apply_rule(self):
        self.rel['tags']['except']='motorcycle,bicycle'
        self.assertEqual(self.norm()['status'],'unresolved')
    def test_via_way_is_pending_not_silently_ignored(self):
        self.rel['members'][1]={'type':'way','ref':30,'role':'via'}
        r=self.norm();self.assertEqual(r['status'],'unresolved')
        d=tr.evaluate_transition([r],'car',self.inc,self.out)
        self.assertFalse(d['coverage_complete']);self.assertEqual(d['unlocated_pending_relations'],[100])
    def test_missing_member_is_invalid(self):
        del self.elements['way',20]
        self.assertEqual(self.norm()['status'],'invalid')
    def test_nonconnecting_member_is_invalid(self):
        self.elements['way',20]['nodes']=[3,4]
        self.assertEqual(self.norm()['status'],'invalid')
    def test_ambiguous_approach_is_pending(self):
        self.elements['way',10]['nodes']=[1,2,3]
        self.assertEqual(self.norm()['status'],'unresolved')
    def test_unknown_type_and_no_entry_are_pending(self):
        for v in ['no_entry','no_exit','not_real','no_left_turn @ (07:00-09:00)']:
            self.rel['tags']['restriction']=v;self.assertEqual(self.norm()['status'],'unresolved')
    def test_conflicting_only_rules_are_flagged(self):
        self.rel['tags']['restriction']='only_right_turn'
        a=self.norm();other=copy.deepcopy(self.rel);other['id']=101;other['members'][-1]['ref']=30
        b=tr.normalize(other,'car',self.elements,self.rules)
        records=tr.mark_only_conflicts([a,b])
        self.assertTrue(all(r['status']=='unresolved' for r in records))
    def test_disconnected_transition_not_accepted(self):
        d=tr.evaluate_transition([],'car',self.inc,tr.reverse_segment(self.out))
        self.assertEqual(d['state'],'invalid_transition')
    def test_audit_keeps_source_and_counts_three_profiles(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);snap=root/'snapshot';snap.mkdir()
            (snap/'metadata.json').write_text(json.dumps({'status':'completed','dataset_version':'synthetic'}))
            raw=json.dumps({'elements':[*self.elements.values(),self.rel]}).encode()
            (snap/'osm-raw.json').write_bytes(raw)
            run,summary=tr.audit(snap,root/'output')
            self.assertEqual((snap/'osm-raw.json').read_bytes(),raw)
            meta=json.loads((run/'metadata.json').read_text())
            self.assertEqual(meta['relation_count'],1);self.assertEqual(meta['profile_decision_count'],3)
            self.assertFalse(meta['graph_created'])


if __name__=='__main__':unittest.main()
