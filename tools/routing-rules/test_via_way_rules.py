import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import turn_rules as tr
import via_way_rules as v

class ViaWayTests(unittest.TestCase):
    def setUp(self):
        self.rules,_=tr.load_rules()
        self.es={('node',i):{'type':'node','id':i} for i in range(1,10)}
        for wid,ns in [(10,[1,2]),(20,[2,3,4]),(30,[4,5]),(40,[3,6]),(50,[7,2])]:self.es['way',wid]={'type':'way','id':wid,'nodes':ns}
        self.rel={'type':'relation','id':100,'tags':{'type':'restriction','restriction':'no_left_turn'},'members':[{'type':'way','ref':10,'role':'from'},{'type':'way','ref':20,'role':'via'},{'type':'way','ref':30,'role':'to'}]}
        self.path=[tr.segment(w,i,d,self.es['way',w]['nodes']) for w,i,d in [(10,0,'forward'),(20,0,'forward'),(20,1,'forward'),(30,0,'forward')]]
    def norm(self):return v.normalize(self.rel,'car',self.es,self.rules)
    def machine(self):return v.RestrictionMachine([self.norm()],'car')
    def feed(self,path,m=None):
        m=m or self.machine();history=[];result=None
        for s in path:
            result=m.advance(history,s)
            if result['state']!='not_blocked_by_evaluated_rules':break
            history=result['next_history']
        return result
    def test_no_blocks_full_chain_only(self):
        r=self.norm();self.assertEqual(r['status'],'ready');self.assertEqual(len(r['sequence_patterns'][0]['segments']),4)
        self.assertEqual(self.feed(self.path)['state'],'forbidden')
        self.assertEqual(self.feed(self.path[:3])['state'],'not_blocked_by_evaluated_rules')
    def test_other_entry_not_blocked(self):
        alt=tr.segment(50,0,'forward',[7,2])
        self.assertEqual(self.feed([alt,*self.path[1:]])['state'],'not_blocked_by_evaluated_rules')
    def test_no_allows_early_exit(self):
        alt=tr.segment(40,0,'forward',[3,6])
        self.assertEqual(self.feed([*self.path[:2],alt])['state'],'not_blocked_by_evaluated_rules')
    def test_only_blocks_early_exit(self):
        self.rel['tags']['restriction']='only_left_turn'
        alt=tr.segment(40,0,'forward',[3,6])
        self.assertEqual(self.feed([*self.path[:2],alt])['state'],'forbidden')
        self.assertEqual(self.feed(self.path)['state'],'not_blocked_by_evaluated_rules')
    def test_only_blocks_wrong_first_exit(self):
        self.rel['tags']['restriction']='only_left_turn'
        self.assertEqual(self.feed([self.path[0],tr.reverse_segment(self.path[0])])['state'],'forbidden')
    def test_reverse_via_source_order(self):
        self.es['way',20]['nodes']=[4,3,2]
        r=self.norm();self.assertEqual(r['status'],'ready')
        chain=r['sequence_patterns'][0]['segments']
        self.assertEqual([s['segment_index'] for s in chain[1:-1]],[1,0])
        self.assertTrue(all(s['direction']=='backward' for s in chain[1:-1]))
    def test_multiple_via(self):
        self.es['way',20]['nodes']=[2,3];self.es['way',21]={'type':'way','id':21,'nodes':[3,4]}
        self.rel['members'].insert(2,{'type':'way','ref':21,'role':'via'})
        self.assertEqual(self.norm()['status'],'ready')
        self.assertEqual(self.feed(self.norm()['sequence_patterns'][0]['segments'])['state'],'forbidden')
    def test_order_not_guessed(self):
        self.es['way',21]={'type':'way','id':21,'nodes':[4,6]}
        self.rel['members'].insert(1,{'type':'way','ref':21,'role':'via'})
        self.assertEqual(self.norm()['status'],'invalid')
    def test_shared_nodes_ambiguous(self):
        self.es['way',10]['nodes']=[1,2,3]
        self.assertEqual(self.norm()['status'],'unresolved')
    def test_join_inside_way_pending(self):
        self.es['way',10]['nodes']=[1,2,7]
        self.assertEqual(self.norm()['status'],'unresolved')
    def test_missing_node_invalid(self):
        del self.es['node',3];self.assertEqual(self.norm()['status'],'invalid')
    def test_missing_way_invalid(self):
        del self.es['way',20];self.assertEqual(self.norm()['status'],'invalid')
    def test_closed_way_pending(self):
        self.es['way',20]['nodes']=[2,3,4,2];self.assertEqual(self.norm()['status'],'unresolved')
    def test_repeated_via_pending(self):
        self.rel['members'].insert(2,copy.deepcopy(self.rel['members'][1]));self.assertEqual(self.norm()['status'],'unresolved')
    def test_exempt_and_walking(self):
        self.rel['tags']['except']='motorcycle'
        self.assertEqual(v.normalize(self.rel,'motorcycle',self.es,self.rules)['status'],'exempt')
        self.assertEqual(v.normalize(self.rel,'walking',self.es,self.rules)['status'],'not_applicable')
    def test_time_active_and_inactive(self):
        self.rel['tags'].pop('restriction');self.rel['tags']['restriction:conditional']='no_left_turn @ (Mo-Fr 07:00-09:00)'
        morning=v.evaluate_at([self.rel],self.es,self.rules,'2026-10-29T08:00:00+07:00')
        noon=v.evaluate_at([self.rel],self.es,self.rules,'2026-10-29T12:00:00+07:00')
        self.assertEqual(self.feed(self.path,v.RestrictionMachine(morning,'car'))['state'],'forbidden')
        self.assertEqual(self.feed(self.path,v.RestrictionMachine(noon,'car'))['state'],'not_blocked_by_evaluated_rules')
    def test_unsupported_time_never_open(self):
        self.rel['tags']['restriction:conditional']='no_left_turn @ (PH)'
        rs=v.evaluate_at([self.rel],self.es,self.rules,'2026-10-29T08:00:00+07:00')
        result=self.feed(self.path,v.RestrictionMachine(rs,'car'))
        self.assertFalse(result['coverage_complete']);self.assertEqual(rs[0]['status'],'unresolved')
    def test_disconnected_history_and_transition(self):
        with self.assertRaises(ValueError):self.machine().advance([self.path[0],self.path[-1]],self.path[-1])
        self.assertEqual(self.machine().advance([self.path[0]],self.path[-1])['state'],'invalid_transition')
    def test_overlapping_only_and_no_conjunction(self):
        only=copy.deepcopy(self.rel);only['id']=101;only['tags']['restriction']='only_left_turn'
        records=[self.norm(),v.normalize(only,'car',self.es,self.rules)]
        self.assertEqual(self.feed(self.path,v.RestrictionMachine(records,'car'))['state'],'forbidden')
    def test_history_bounded_and_source_unchanged(self):
        old=copy.deepcopy(self.rel);m=self.machine();h=[]
        for s in self.path[:3]:h=m.advance(h,s)['next_history']
        self.assertLessEqual(len(h),m.limit);self.assertEqual(self.rel,old)
    def test_from_equals_to_ambiguous_not_guessed(self):
        self.es['way',10]['nodes']=[1,2,4,5];self.rel['members'][-1]['ref']=10
        self.assertEqual(self.norm()['status'],'unresolved')
    def test_mixed_times_rejected(self):
        a=self.norm();a['evaluated_at']='a';b=copy.deepcopy(a);b['evaluated_at']='b'
        with self.assertRaises(ValueError):v.RestrictionMachine([a,b],'car')
    def test_same_node_different_histories(self):
        a=self.path[:3];other=[tr.segment(50,0,'forward',[7,2]),*self.path[1:3]]
        self.assertEqual(a[-1]['to_node'],other[-1]['to_node'])
        m=self.machine()
        self.assertEqual(m.advance(a,self.path[-1])['state'],'forbidden')
        self.assertEqual(m.advance(other,self.path[-1])['state'],'not_blocked_by_evaluated_rules')
    def test_conflicting_only_chains_block_both_targets(self):
        self.rel['tags']['restriction']='only_left_turn';a=self.norm()
        b=copy.deepcopy(a);b['relation_id']=101
        b['sequence_patterns'][0]['segments']=self.path[:2]+[tr.segment(40,0,'forward',[3,6])]
        m=v.RestrictionMachine([a,b],'car')
        self.assertEqual(m.advance(self.path[:2],self.path[2])['state'],'forbidden')
        self.assertEqual(m.advance(self.path[:2],tr.segment(40,0,'forward',[3,6]))['state'],'forbidden')
    def test_no_deviation_resets_prefix(self):
        alt=tr.segment(40,0,'forward',[3,6]);back=tr.reverse_segment(alt)
        self.assertEqual(self.feed([*self.path[:2],alt,back,*self.path[2:]])['state'],'not_blocked_by_evaluated_rules')
    def test_audit_and_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);snap=root/'snapshot';snap.mkdir();raw=json.dumps({'elements':[*self.es.values(),self.rel]}).encode()
            (snap/'osm-raw.json').write_bytes(raw);(snap/'metadata.json').write_text(json.dumps({'status':'completed','dataset_version':'synthetic','raw_sha256':hashlib.sha256(raw).hexdigest()}),encoding='utf-8')
            run,rows,rs=v.audit(snap,root/'out','2026-10-29T08:00:00+07:00')
            self.assertEqual(sum(r['count'] for r in rows),3)
            self.assertEqual((snap/'osm-raw.json').read_bytes(),raw)
            self.assertFalse(json.loads((run/'metadata.json').read_text(encoding='utf-8'))['graph_created'])
            (snap/'osm-raw.json').write_bytes(raw+b' ')
            with self.assertRaises(ValueError):v.audit(snap,root/'out','2026-10-29T08:00:00+07:00')

if __name__=='__main__':unittest.main()
