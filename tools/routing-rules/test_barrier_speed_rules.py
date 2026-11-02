import copy
import hashlib
import json
import math
from pathlib import Path
import tempfile
import unittest
import barrier_speed_rules as b

class BarrierSpeedTests(unittest.TestCase):
    def setUp(self):self.config,_=b.load_config()
    def barrier(self,tags,p='car'):return b.barrier(tags,p,self.config)
    def speed(self,tags,p='car',d='forward',at='2026-10-29T08:00:00+07:00'):return b.speed(tags,p,d,self.config,at)
    def test_gate_missing_state_pending(self):
        self.assertEqual(self.barrier({'barrier':'gate','access':'yes'})['state'],'unresolved')
    def test_gate_unlocked_with_permission(self):
        self.assertEqual(self.barrier({'barrier':'gate','access':'yes','locked':'no'})['state'],'allowed_by_model')
    def test_gate_unlocked_does_not_grant_access(self):
        self.assertEqual(self.barrier({'barrier':'gate','locked':'no'})['state'],'unresolved')
    def test_lock_not_opened_by_yes(self):
        self.assertEqual(self.barrier({'barrier':'gate','access':'yes','locked':'yes','open':'yes'})['state'],'unresolved')
    def test_specific_permission_and_unknown(self):
        t={'barrier':'gate','access':'no','motorcar':'yes','open':'yes'}
        self.assertEqual(self.barrier(t)['state'],'allowed_by_model')
        t['motorcar']='weird';t['access']='yes';self.assertEqual(self.barrier(t)['state'],'unresolved')
    def test_private_and_destination(self):
        for value in ['private','destination','customers']:
            self.assertEqual(self.barrier({'barrier':'gate','access':value,'locked':'no'})['state'],'restricted')
    def test_wall_not_opened_by_access(self):
        self.assertEqual(self.barrier({'barrier':'wall','motorcar':'yes'})['state'],'forbidden')
    def test_bollard_profiles(self):
        self.assertEqual(self.barrier({'barrier':'bollard'})['state'],'forbidden')
        self.assertEqual(self.barrier({'barrier':'bollard'},'motorcycle')['state'],'unresolved')
        self.assertEqual(self.barrier({'barrier':'bollard'},'walking')['state'],'allowed_by_model')
    def test_qualified_access_is_pending(self):
        self.assertEqual(self.barrier({'barrier':'gate','access':'yes','open':'yes','motorcar:conditional':'no @ wet'})['state'],'unresolved')
    def test_opening_hours_pending(self):
        self.assertEqual(self.barrier({'barrier':'gate','access':'yes','open':'yes','opening_hours':'24/7'})['state'],'unresolved')
    def test_dimensions_block_specific_vehicle(self):
        tags={'maxwidth:physical':'1.5'}
        self.assertEqual(b.dimensions(tags,'car',self.config)['state'],'forbidden')
        self.assertEqual(b.dimensions(tags,'motorcycle',self.config)['state'],'not_blocked_by_known_dimensions')
    def test_dimensions_equality_and_both_limits(self):
        self.assertEqual(b.dimensions({'maxwidth':'1.8'},'car',self.config)['state'],'forbidden')
        self.assertEqual(b.dimensions({'maxwidth':'2.5','maxwidth:physical':'1.7'},'car',self.config)['state'],'forbidden')
    def test_dimension_units_and_unknown(self):
        self.assertEqual(b.dimensions({'maxheight':'2 m'},'car',self.config)['state'],'not_blocked_by_known_dimensions')
        for value in ['none','6 ft','2,5','0','NaN']:
            self.assertEqual(b.dimensions({'maxheight':value},'car',self.config)['state'],'unresolved')
        self.assertEqual(b.dimensions({'maxheight':'2'},'walking',self.config)['state'],'unresolved')
    def test_dimension_conditional_and_mass(self):
        self.assertEqual(b.dimensions({'maxheight:conditional':'2 @ wet'},'car',self.config)['state'],'unresolved')
        self.assertEqual(b.dimensions({'maxweight':'3.5'},'car',self.config)['state'],'not_blocked_by_known_dimensions')
    def test_missing_limit_is_not_verified_clearance(self):
        self.assertEqual(b.dimensions({},'car',self.config)['state'],'not_blocked_by_known_dimensions')
    def test_speed_missing_uses_labeled_assumption(self):
        r=self.speed({'highway':'primary'});self.assertEqual(r['effective_kmh'],30);self.assertEqual(r['limit_status'],'missing');self.assertTrue(r['assumed_estimate'])
    def test_speed_cap_not_actual_speed(self):
        self.assertEqual(self.speed({'highway':'primary','maxspeed':'60'})['effective_kmh'],30)
        self.assertEqual(self.speed({'highway':'primary','maxspeed':'20'})['effective_kmh'],20)
    def test_speed_mph_and_decimal(self):
        self.assertAlmostEqual(self.speed({'highway':'primary','maxspeed':'10 mph'})['limit_kmh'],16.09344)
        self.assertEqual(self.speed({'highway':'primary','maxspeed':'12.5 km/h'})['effective_kmh'],12.5)
    def test_directional_speed(self):
        t={'highway':'primary','maxspeed':'30','maxspeed:forward':'20','maxspeed:backward':'10'}
        self.assertEqual(self.speed(t)['effective_kmh'],20);self.assertEqual(self.speed(t,d='backward')['effective_kmh'],10)
    def test_specific_profile_and_bad_specific(self):
        t={'highway':'primary','maxspeed':'30','maxspeed:motorcycle':'15'}
        self.assertEqual(self.speed(t,'motorcycle')['effective_kmh'],15);self.assertEqual(self.speed(t)['effective_kmh'],30)
        t['maxspeed:motorcar']='signals';self.assertEqual(self.speed(t)['state'],'unresolved')
    def test_walking_ignores_vehicle_maxspeed(self):
        self.assertEqual(self.speed({'highway':'footway','maxspeed':'signals'},'walking')['effective_kmh'],4.5)
    def test_bad_speed_not_fallback(self):
        for value in ['none','walk','VN:urban','30;50','30|50','0','-5','NaN']:
            self.assertEqual(self.speed({'highway':'primary','maxspeed':value})['state'],'unresolved')
    def test_lane_and_variable_pending(self):
        for key in ['maxspeed:lanes','maxspeed:variable','maxspeed:forward:lanes']:
            self.assertEqual(self.speed({'highway':'primary',key:'20'})['state'],'unresolved')
    def test_conditional_speed(self):
        t={'highway':'primary','maxspeed':'25','maxspeed:conditional':'10 @ (Mo-Fr 07:00-09:00)'}
        self.assertEqual(self.speed(t)['effective_kmh'],10)
        self.assertEqual(self.speed(t,at='2026-10-29T12:00:00+07:00')['effective_kmh'],25)
    def test_unsupported_conditional_and_naive(self):
        self.assertEqual(self.speed({'highway':'primary','maxspeed:conditional':'10 @ (PH)'})['state'],'unresolved')
        with self.assertRaises(ValueError):self.speed({'highway':'primary'},at='2026-10-29T08:00:00')
    def test_unknown_road_not_limit_as_estimate(self):
        self.assertEqual(self.speed({'highway':'road','maxspeed':'30'})['state'],'unresolved')
    def test_speed_not_access_permission(self):
        r=self.speed({'highway':'primary','access':'no'});self.assertEqual(r['state'],'estimated')
        self.assertNotIn('allowed',r)
    def test_time_and_invalid_length(self):
        r=self.speed({'highway':'primary','maxspeed':'18'})
        self.assertEqual(b.base_time_seconds(100,r),20)
        for n in [-1,float('nan'),float('inf'),True]:
            with self.assertRaises(ValueError):b.base_time_seconds(n,r)
    def test_inputs_unchanged(self):
        tags={'highway':'primary','barrier':'gate','access':'yes','locked':'no'};old=copy.deepcopy(tags)
        self.speed(tags);self.barrier(tags);self.assertEqual(tags,old)
    def test_invalid_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'rules.json';c=copy.deepcopy(self.config);c['estimated_kmh']['primary'][0]=0
            p.write_text(json.dumps(c),encoding='utf-8')
            with self.assertRaises(ValueError):b.load_config(p)
    def test_length_uses_raw_node_order(self):
        es={('node',1):{'lat':0,'lon':0},('node',2):{'lat':0,'lon':0.001},('node',3):{'lat':0.001,'lon':0.001}}
        self.assertAlmostEqual(b.way_length_m({'nodes':[1,2,3]},es),222.39016,places=3)
        with self.assertRaises(ValueError):b.way_length_m({'nodes':[1,4]},es)
    def test_audit_scope_hash_and_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);snap=root/'snapshot';snap.mkdir()
            raw=json.dumps({'elements':[{'type':'node','id':1,'lat':21.0,'lon':105.8,'tags':{'barrier':'gate'}},{'type':'node','id':2,'lat':21.001,'lon':105.8},{'type':'way','id':10,'nodes':[1,2],'tags':{'highway':'primary'}}]}).encode()
            (snap/'osm-raw.json').write_bytes(raw);(snap/'metadata.json').write_text(json.dumps({'status':'completed','dataset_version':'test','raw_sha256':hashlib.sha256(raw).hexdigest()}),encoding='utf-8')
            (snap/'roads.geojson').write_text(json.dumps({'features':[{'geometry':{'type':'LineString'},'properties':{'osm_way_id':10,'scope':'study_intersection','osm_tags':{'highway':'primary'}}}]}),encoding='utf-8')
            run,rows=b.audit(snap,root/'out','2026-10-29T08:00:00+07:00')
            meta=json.loads((run/'metadata.json').read_text(encoding='utf-8'));self.assertEqual(meta['study_linear_ways'],1);self.assertEqual(meta['barrier_nodes_on_study_way'],1)
            self.assertEqual((snap/'osm-raw.json').read_bytes(),raw)
            (snap/'osm-raw.json').write_bytes(raw+b' ')
            with self.assertRaises(ValueError):b.audit(snap,root/'out','2026-10-29T08:00:00+07:00')

if __name__=='__main__':unittest.main()
