import json
from pathlib import Path
import tempfile
import unittest

import access_rules as access
import direction_rules as direction


class DirectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ar,_=access.load_rules();cls.dr,_=direction.load_rules()

    def decisions(self,tags,profile='car'):
        return {d['direction']:d for d in direction.classify(tags,profile,self.ar,self.dr)}

    def test_yes_forward_only(self):
        d=self.decisions({'highway':'residential','oneway':'yes'})
        self.assertEqual((d['forward']['state'],d['backward']['state']),('allowed','forbidden'))

    def test_minus_one_is_reverse_of_source_not_compass(self):
        d=self.decisions({'highway':'residential','oneway':'-1'})
        self.assertEqual((d['forward']['state'],d['backward']['state']),('forbidden','allowed'))

    def test_explicit_no_and_missing_have_different_sources(self):
        a=self.decisions({'highway':'residential','oneway':'no'})
        b=self.decisions({'highway':'residential'})
        self.assertEqual(a['forward']['state'],'allowed');self.assertEqual(a['backward']['state'],'allowed')
        self.assertEqual(a['forward']['oneway_key'],'oneway')
        self.assertEqual(b['forward']['oneway_key'],'missing_oneway_default')

    def test_motorcycle_exception_does_not_change_car(self):
        tags={'highway':'residential','oneway':'yes','oneway:motorcycle':'no'}
        self.assertEqual(self.decisions(tags,'car')['backward']['state'],'forbidden')
        self.assertEqual(self.decisions(tags,'motorcycle')['backward']['state'],'allowed')

    def test_walking_does_not_inherit_vehicle_oneway_on_streets(self):
        d=self.decisions({'highway':'residential','oneway':'yes'},'walking')
        self.assertEqual(d['backward']['state'],'allowed')

    def test_explicit_walking_reverse(self):
        d=self.decisions({'highway':'footway','oneway:foot':'-1'},'walking')
        self.assertEqual((d['forward']['state'],d['backward']['state']),('forbidden','allowed'))

    def test_ambiguous_footway_global_oneway_is_unresolved(self):
        for h in ['footway','path','corridor']:
            d=self.decisions({'highway':h,'oneway':'yes'},'walking')
            self.assertEqual(d['forward']['state'],'unresolved')

    def test_steps_global_oneway_applies_to_walking(self):
        d=self.decisions({'highway':'steps','oneway':'yes'},'walking')
        self.assertEqual((d['forward']['state'],d['backward']['state']),('allowed','forbidden'))

    def test_roundabout_implicit_but_not_circular(self):
        d=self.decisions({'highway':'residential','junction':'roundabout'})
        self.assertEqual(d['backward']['state'],'forbidden')
        d=self.decisions({'highway':'residential','junction':'circular'})
        self.assertEqual(d['backward']['state'],'allowed')

    def test_explicit_no_overrides_roundabout_default(self):
        d=self.decisions({'highway':'residential','junction':'roundabout','oneway':'no'})
        self.assertEqual(d['backward']['state'],'allowed')

    def test_reversible_alternating_and_unknown_are_unresolved(self):
        for v in ['reversible','alternating','weird']:
            d=self.decisions({'highway':'residential','oneway':v})
            self.assertEqual(d['forward']['state'],'unresolved')

    def test_oneway_conditional_not_ignored(self):
        tags={'highway':'residential','oneway':'yes','oneway:conditional':'no @ (20:00-06:00)'}
        self.assertEqual(self.decisions(tags)['forward']['state'],'unresolved')
        self.assertEqual(self.decisions(tags,'walking')['backward']['state'],'allowed')

    def test_other_vehicle_exception_not_inherited(self):
        tags={'highway':'residential','oneway':'yes','oneway:bicycle':'no','oneway:moped':'no'}
        self.assertEqual(self.decisions(tags,'motorcycle')['backward']['state'],'forbidden')

    def test_other_mode_conditional_not_inherited(self):
        tags={'highway':'residential','oneway':'yes','oneway:psv:conditional':'no @ (07:00-09:00)'}
        self.assertEqual(self.decisions(tags)['forward']['state'],'allowed')

    def test_direction_access_can_deny_one_side(self):
        d=self.decisions({'highway':'residential','motorcar:backward':'no'})
        self.assertEqual((d['forward']['state'],d['backward']['state']),('allowed','forbidden'))
        self.assertEqual(d['backward']['access_key'],'motorcar:backward')

    def test_specific_direction_access_overrides_parent_not_specific_base(self):
        d=self.decisions({'highway':'residential','access':'no','motorcar:forward':'yes'})
        self.assertEqual((d['forward']['state'],d['backward']['state']),('allowed','forbidden'))
        d=self.decisions({'highway':'residential','motorcar':'no','access:forward':'yes'})
        self.assertEqual(d['forward']['state'],'forbidden')

    def test_access_yes_cannot_cancel_oneway_no_exception(self):
        d=self.decisions({'highway':'residential','oneway':'yes','motorcar:backward':'yes'})
        self.assertEqual(d['backward']['state'],'forbidden')

    def test_oneway_exception_does_not_grant_forbidden_access(self):
        d=self.decisions({'highway':'residential','oneway:motorcycle':'no','motorcycle':'no'},'motorcycle')
        self.assertEqual(d['forward']['state'],'forbidden');self.assertEqual(d['backward']['state'],'forbidden')

    def test_static_direction_removed_but_conditional_preserved(self):
        d=self.decisions({'highway':'residential','motorcar:forward:conditional':'no @ (07:00-09:00)'})
        self.assertEqual(d['forward']['state'],'unresolved');self.assertEqual(d['backward']['state'],'unresolved')

    def test_scope_and_destination_are_not_opened_by_direction(self):
        d=self.decisions({'highway':'motorway','oneway':'no'})
        self.assertEqual(d['forward']['state'],'excluded')
        d=self.decisions({'highway':'service','motorcar':'destination','oneway':'yes'})
        self.assertEqual(d['forward']['state'],'restricted');self.assertEqual(d['backward']['state'],'forbidden')

    def test_audit_matches_node_order_and_rejects_reversed_geometry(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);snap=root/'snapshot';snap.mkdir()
            (snap/'metadata.json').write_text(json.dumps({'status':'completed','dataset_version':'synthetic'}))
            raw={'elements':[{'type':'node','id':1,'lon':105.81,'lat':21.0},
                             {'type':'node','id':2,'lon':105.82,'lat':21.01},
                             {'type':'way','id':10,'nodes':[1,2]}]}
            (snap/'osm-raw.json').write_text(json.dumps(raw))
            f={'properties':{'scope':'study_intersection','osm_way_id':10,
                             'osm_tags':{'highway':'residential','oneway':'yes'}},
               'geometry':{'type':'LineString','coordinates':[[105.81,21.0],[105.82,21.01]]}}
            (snap/'roads.geojson').write_text(json.dumps({'features':[f]}))
            run,summary=direction.audit(snap,root/'out')
            meta=json.loads((run/'metadata.json').read_text())
            self.assertEqual(meta['decision_count'],6);self.assertEqual(meta['node_order_unverified_ways'],0)
            f['geometry']['coordinates'].reverse()
            (snap/'roads.geojson').write_text(json.dumps({'features':[f]}))
            run,summary=direction.audit(snap,root/'out')
            self.assertEqual(json.loads((run/'metadata.json').read_text())['node_order_unverified_ways'],1)
            self.assertEqual(sum(r['way_count'] for r in summary if r['state']=='allowed'),0)


if __name__=='__main__':unittest.main()
