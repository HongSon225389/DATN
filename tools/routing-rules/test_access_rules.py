import unittest
import csv
import json
from pathlib import Path
import tempfile
import access_rules as ar


class AccessRulesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.rules,_=ar.load_rules()
    def check(self,tags,profile,state,key=None):
        d=ar.classify(tags,profile,self.rules)
        self.assertEqual(d['state'],state)
        self.assertEqual(d['through_eligible_by_way_access'],state=='allowed')
        if key:self.assertEqual(d['source_key'],key)
        return d

    def test_specific_vehicle_overrides_general_denial(self):
        t={'highway':'residential','access':'no','motorcycle':'yes'}
        self.check(t,'car','forbidden','access');self.check(t,'motorcycle','allowed','motorcycle')

    def test_motor_vehicle_denial_does_not_apply_to_foot(self):
        t={'highway':'residential','motor_vehicle':'no'}
        self.check(t,'car','forbidden');self.check(t,'motorcycle','forbidden');self.check(t,'walking','allowed')

    def test_vehicle_denial_does_not_apply_to_foot(self):
        self.check({'highway':'residential','vehicle':'no'},'walking','allowed')

    def test_specific_unknown_does_not_fall_back_to_allow(self):
        self.check({'highway':'residential','motorcar':'*','access':'yes'},'car','unresolved','motorcar')

    def test_destination_is_restricted_not_absolute_no(self):
        self.check({'highway':'residential','motorcar':'destination'},'car','restricted')

    def test_general_yes_does_not_open_footway_to_motor_vehicles(self):
        self.check({'highway':'footway','access':'yes'},'car','forbidden','highway_default')

    def test_specific_yes_can_override_footway_default_with_warning(self):
        d=self.check({'highway':'footway','motorcycle':'yes'},'motorcycle','allowed')
        self.assertIn('ghi đè',d['warning'])

    def test_conditional_is_unresolved_even_if_base_yes(self):
        t={'highway':'residential','motor_vehicle':'yes','motor_vehicle:conditional':'no @ (07:00-09:00)'}
        self.check(t,'car','unresolved');self.check(t,'walking','allowed')

    def test_directional_access_is_not_silently_ignored(self):
        self.check({'highway':'residential','motorcar:backward':'no'},'car','unresolved')

    def test_lane_like_scalar_is_unresolved(self):
        self.check({'highway':'residential','motorcycle':'yes|yes|designated'},'motorcycle','unresolved')

    def test_permissive_and_discouraged_keep_warning(self):
        for v in ['permissive','discouraged']:
            self.assertTrue(self.check({'highway':'service','access':v},'car','allowed')['warning'])

    def test_private_with_specific_foot_yes(self):
        t={'highway':'service','access':'private','foot':'yes'}
        self.check(t,'car','restricted');self.check(t,'walking','allowed','foot')

    def test_construction_and_area_excluded_before_explicit_yes(self):
        self.check({'highway':'construction','motorcar':'yes'},'car','excluded')
        self.check({'highway':'pedestrian','area':'yes','foot':'yes'},'walking','excluded')

    def test_motorway_excluded_by_scope_for_all_profiles(self):
        for p in self.rules['profiles']:self.check({'highway':'motorway'},p,'excluded')

    def test_steps_not_for_motorized_and_foot_use_sidepath(self):
        self.check({'highway':'steps','motorcycle':'yes'},'motorcycle','excluded')
        self.check({'highway':'steps'},'walking','allowed')
        self.check({'highway':'residential','foot':'use_sidepath'},'walking','forbidden')

    def test_unknown_class_and_trunk_do_not_assume_access(self):
        self.check({'highway':'mystery'},'car','unresolved')
        self.check({'highway':'trunk','access':'yes'},'motorcycle','unresolved')

    def test_generic_designated_is_not_interpreted_as_all_modes(self):
        self.check({'highway':'residential','access':'designated'},'car','unresolved')

    def test_scope_separates_turns_and_oneway_from_way_access(self):
        self.check({'highway':'residential','oneway':'yes'},'car','allowed')

    def test_invalid_profile_and_tags_fail(self):
        with self.assertRaises(ValueError):ar.classify({'highway':'residential'},'truck',self.rules)
        with self.assertRaises(ValueError):ar.classify({'highway':None},'car',self.rules)

    def test_audit_three_profiles_and_unchanged_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);snapshot=root/'snapshot';snapshot.mkdir()
            (snapshot/'metadata.json').write_text(json.dumps({'status':'completed','dataset_version':'synthetic-test','study_bbox_wsen':[105.8,20.99,105.85,21.04]}))
            features=[]
            for key,tags in [(1,{'highway':'residential'}),(2,{'highway':'footway'}),(3,{'highway':'pedestrian','area':'yes'})]:
                features.append({'properties':{'osm_way_id':key,'scope':'study_intersection','osm_tags':tags}})
            source=json.dumps({'features':features}).encode()
            (snapshot/'roads.geojson').write_bytes(source)
            run,summary=ar.audit(snapshot,root/'output')
            self.assertEqual((snapshot/'roads.geojson').read_bytes(),source)
            with (run/'way-access.csv').open(encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
            self.assertEqual(len(rows),6)
            for profile in self.rules['profiles']:
                self.assertEqual(sum(r['way_count'] for r in summary if r['profile']==profile),2)
            self.assertEqual(json.loads((run/'metadata.json').read_text())['decision_count'],6)


if __name__=='__main__':unittest.main()
