import unittest,copy
import barrier_speed_rules as b
class MassTests(unittest.TestCase):
 def setUp(self):self.c=b.load_config()[0]
 def state(self,t,p='car'):return b.dimensions(t,p,self.c)['state']
 def test_bridge_and_equality(self):
  for v in ['30','30 t','30000 kg','2.5']:self.assertEqual(self.state({'maxweight':v}),'not_blocked_by_known_dimensions')
 def test_overweight(self):self.assertEqual(self.state({'maxweight':'2'}),'forbidden')
 def test_motorcycle_loaded(self):
  self.assertEqual(self.state({'maxweight':'0.3'},'motorcycle'),'forbidden')
  self.assertEqual(self.state({'maxweight':'0.35'},'motorcycle'),'not_blocked_by_known_dimensions')
 def test_bad_units(self):
  for v in ['30 tons','30;5','0','-1','nan','30 @ (Mo-Fr)']:self.assertEqual(self.state({'maxweight':v}),'unresolved')
 def test_explicit_units(self):
  self.assertAlmostEqual(b.mass_tonnes('1000 kg'),1)
  self.assertAlmostEqual(b.mass_tonnes('1 st'),.90718474)
  self.assertAlmostEqual(b.mass_tonnes('1000 lbs'),.45359237)
 def test_missing_mass(self):
  self.c['vehicles']['car']['actual_weight_t']=None
  self.assertEqual(self.state({'maxweight':'30'}),'unresolved')
 def test_conditional_directional_not_ignored(self):
  for k in ['maxweight:conditional','maxweight:forward','maxweight:motorcar']:
   self.assertEqual(self.state({'maxweight':'30',k:'5'}),'unresolved')
 def test_axle_upper_bound(self):
  self.assertEqual(self.state({'maxaxleload':'3'}),'not_blocked_by_known_dimensions')
  self.assertEqual(self.state({'maxaxleload':'1'}),'unresolved')
 def test_axle_explicit(self):
  self.c['vehicles']['car']['max_axle_load_t']=1.5
  self.assertEqual(self.state({'maxaxleload':'1'}),'forbidden')
  self.assertEqual(self.state({'maxaxleload':'1.5'}),'not_blocked_by_known_dimensions')
 def test_rating_separate(self):self.assertEqual(self.state({'maxweightrating':'30'}),'unresolved')
 def test_access_stays_denied(self):self.assertEqual(b.barrier({'barrier':'gate','access':'no','maxweight':'30'},'car',self.c)['state'],'forbidden')
 def test_signed_metadata(self):
  for v in ['yes','no']:self.assertEqual(self.state({'maxweight:signed':v}),'not_blocked_by_known_dimensions')
  self.assertEqual(self.state({'maxweight':'2','maxweight:signed':'no'}),'forbidden')
  self.assertEqual(self.state({'maxweight:signed':'bad'}),'unresolved')
 def test_hgv_not_passenger_car_or_motorcycle(self):
  for p in ['car','motorcycle']:
   for k in ['maxweightrating:hgv','maxweight:hgv:conditional','maxweight:hgv_articulated']:
    self.assertEqual(self.state({k:'0.5'},p),'not_blocked_by_known_dimensions')
 def test_other_unknown_stays(self):self.assertEqual(self.state({'maxweight':'30','maxlength':'5'}),'unresolved')
