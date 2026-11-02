import copy
from pathlib import Path
import tempfile
import unittest
import pending_graph_diagnostics as p
import inspect_graph as ig
import build_graph as bg

class PendingGraphTests(unittest.TestCase):
    def setUp(self):
        self.graph={'profile':'car','nodes':{f'n{i}':{'osm_node_id':i,'lon':105+i*.01,'lat':21,'terminal_port':False} for i in [1,2,3]},'edges':{},'node_controls':{}}
        self.elements={('node',i):{'type':'node','id':i,'lon':105+i*.01,'lat':21} for i in [1,2,3]}
        for wid,ns in [(10,[1,2]),(20,[2,3])]:
            self.elements['way',wid]={'type':'way','id':wid,'nodes':ns,'tags':{'name':'Test'}}
            for direction in ['forward','backward']:
                seg=bg.tr.segment(wid,0,direction,ns);eid=f'{wid}:0:{direction}'
                self.graph['edges'][eid]={**seg,'edge_id':eid,'graph_from':f"n{seg['from_node']}",'graph_to':f"n{seg['to_node']}",'base_time_seconds':1}
        self.maps={w:ig.memberships(self.graph,w)[0] for w in ['distance','time']}
        self.record={'profile':'car','relation_id':100,'status':'invalid','locality':'unlocated','reason':'test','members':[{'type':'way','ref':10,'role':'from'},{'type':'way','ref':20,'role':'to'}],'tags':{'restriction':'no_left_turn'},'member_hint_bbox':[105,21,106,22],'osm_url':'https://www.openstreetmap.org/relation/100'}
    def diagnose(self):return p.diagnose(self.record,self.graph,self.elements,self.maps,p.graph_indexes(self.graph))
    def test_missing_via_is_not_reconstructed_from_common_node(self):
        r,_=self.diagnose();self.assertEqual(r['missing_roles'],['via']);self.assertEqual(r['from_to_common_raw_nodes'],[2]);self.assertFalse(r['scope_proven']);self.assertFalse(r['repair_applied'])
    def test_missing_from_has_candidates_not_repair(self):
        self.record['members']=[{'type':'node','ref':2,'role':'via'},{'type':'way','ref':20,'role':'to'}]
        r,_=self.diagnose();self.assertIn('missing_from',r['defects']);inc=next(x for x in r['incident_candidates'] if x['direction']=='incoming');self.assertEqual(inc['way_ids'],[10,20]);self.assertFalse(r['coverage_changed'])
    def test_missing_to(self):
        self.record['members']=[{'type':'way','ref':10,'role':'from'},{'type':'node','ref':2,'role':'via'}]
        self.assertIn('missing_to',self.diagnose()[0]['defects'])
    def test_multiple_to_and_via_nodes(self):
        self.record['members'] += [{'type':'way','ref':20,'role':'to'},{'type':'node','ref':1,'role':'via'},{'type':'node','ref':2,'role':'via'}]
        defects=self.diagnose()[0]['defects'];self.assertIn('multiple_to',defects);self.assertIn('multiple_or_mixed_via_nodes',defects)
    def test_missing_raw_element(self):
        self.record['members'][0]['ref']=999
        r,ds=self.diagnose();self.assertIn('missing_raw_element',r['defects']);self.assertFalse(ds[0]['exists_in_raw'])
    def test_no_graph_match_does_not_prove_irrelevance(self):
        self.graph['edges']={};self.graph['nodes']={};self.maps={w:{'wcc':{},'scc':{}} for w in ['distance','time']}
        r,_=self.diagnose();self.assertEqual(r['known_member_graph_edges'],0);self.assertFalse(r['scope_proven']);self.assertIn('does NOT prove',r['warning'])
    def test_member_way_matches_both_directions(self):
        r,ds=self.diagnose();self.assertEqual(r['known_member_graph_edges'],4);self.assertEqual(ds[0]['matched_graph_edges'],2);self.assertEqual(r['known_member_wcc'],[1])
    def test_node_member_includes_virtual_ports_and_control(self):
        self.graph['nodes']['b2:10:0']={'osm_node_id':2,'lon':105.02,'lat':21,'terminal_port':True}
        self.graph['node_controls']['2']={'state':'unresolved'}
        self.record['members'].append({'type':'node','ref':2,'role':'via'})
        _,ds=self.diagnose();r=ds[-1];self.assertEqual(r['matched_graph_nodes'],2);self.assertEqual(r['node_control_state'],'unresolved')
    def test_wrong_member_type_and_unknown_role(self):
        self.record['members'][0]['type']='node';self.record['members'].append({'type':'node','ref':1,'role':'extra'})
        r,_=self.diagnose();self.assertIn('wrong_from_to_type',r['defects']);self.assertIn('unknown_member_role',r['defects'])
    def test_conditional_via_way_not_mislabeled_missing(self):
        self.record['members'].append({'type':'way','ref':20,'role':'via'});self.record['status']='unresolved';self.record['reason']='Điều kiện ngoài tập cú pháp hỗ trợ';self.record['tags']['restriction:conditional']='no_left_turn @ (PH)'
        r,_=self.diagnose();self.assertEqual(r['missing_roles'],[]);self.assertIn('unresolved_time_condition',r['defects']);self.assertIn('via_way_without_incoming_guard',r['defects'])
    def test_nonconnecting_from_precisely_flagged(self):
        self.record['members'].append({'type':'node','ref':3,'role':'via'})
        self.assertIn('from_not_connected_to_via_node',self.diagnose()[0]['defects'])
    def dataset(self):
        d=ig.Dataset.__new__(ig.Dataset);d.graphs={'car':self.graph};d.elements=self.elements;d.pending=[self.record];d.maps={('car',w):self.maps[w] for w in self.maps};d.meta={'graph_version':'test','dataset_version':'test'};return d
    def test_default_excludes_local(self):
        d=self.dataset();self.record['locality']='local_guard'
        self.assertEqual(p.analyze(d)[0],[]);self.assertEqual(len(p.analyze(d,True)[0]),1)
    def test_export_preserves_input_and_status(self):
        d=self.dataset();old=copy.deepcopy((self.graph,self.record,self.elements))
        with tempfile.TemporaryDirectory() as tmp:
            run,rs,_=p.export(d,Path(tmp));m=bg.read_json(run/'metadata.json');self.assertEqual(m['profile_decision_count'],1);self.assertEqual(m['unique_relation_count'],1);self.assertFalse(m['coverage_changed']);self.assertTrue((run/'REPORT.md').exists())
        self.assertEqual(old,(self.graph,self.record,self.elements))
    def test_overlap_counts_not_summed_as_unique(self):
        self.record['members']=[]
        with tempfile.TemporaryDirectory() as tmp:
            _,rs,summary=p.export(self.dataset(),Path(tmp));self.assertEqual(len(rs),1);self.assertEqual(sum(r['decision_count'] for r in summary),3)

if __name__=='__main__':unittest.main()
