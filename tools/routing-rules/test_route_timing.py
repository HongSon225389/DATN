import unittest
from route_timing import parse_request,estimate

class TimingTests(unittest.TestCase):
    def setUp(self):self.r={'state':'found','base_time_seconds':90,'evaluated_at':'2026-10-29T08:00:00+07:00','edge_ids':['a']}
    def test_departure(self):
        r=estimate(self.r,parse_request('depart_at','2026-10-29T08:00:00+07:00'))
        self.assertEqual(r['schedule']['estimated_arrival'],'2026-10-29T08:01:30+07:00')
        self.assertFalse(r['schedule']['time_dependent_routing'])
    def test_arrival_previous_day(self):
        r=estimate(self.r,parse_request('arrive_by','2026-10-30T00:00:00+07:00'))
        self.assertEqual(r['schedule']['estimated_departure'],'2026-10-29T23:58:30+07:00')
    def test_fractional_seconds(self):
        r=estimate({**self.r,'base_time_seconds':0.5},parse_request('depart_at','2026-10-29T01:00:00Z'))
        self.assertIn('01:00:00.500000',r['schedule']['estimated_arrival'])
    def test_invalid_or_naive_input(self):
        for mode,value in [('depart_at','2026-10-29T08:00'),('bad','2026-10-29T08:00Z'),('arrive_by','bad'),(None,'2026-10-29T08:00Z')]:
            with self.assertRaises(ValueError):parse_request(mode,value)
    def test_missing_time_and_failed_search(self):
        for r in [{**self.r,'base_time_seconds':None},{'state':'no_route'},{'state':'search_limit'},{**self.r,'base_time_seconds':float('nan')}]:
            self.assertEqual(estimate(r,parse_request('depart_at','2026-10-29T08:00Z'))['schedule']['state'],'unavailable')
    def test_no_mutation_and_no_selection(self):
        self.assertIs(estimate(self.r,None),self.r)
        estimate(self.r,parse_request('depart_at','2030-01-01T08:00Z'))
        self.assertNotIn('schedule',self.r)

if __name__=='__main__':unittest.main()
