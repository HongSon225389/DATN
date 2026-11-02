import copy
from datetime import datetime,timedelta,timezone
from pathlib import Path
import json
import unittest
import time_turn_rules as t
import turn_rules as tr
import via_way_rules as v
import barrier_speed_rules as bs

SCHEDULE='Fr 19:00-23:59; Sa-Su 06:00-23:59'

class DayGroupScheduleTests(unittest.TestCase):
    def test_real_friday_boundaries(self):
        for clock,active in [('18:59:59',False),('19:00:00',True),('23:58:59',True),('23:59:00',False),('23:59:59',False)]:
            self.assertEqual(t.schedule(SCHEDULE,'2026-10-30T'+clock+'+07:00'),active)
    def test_real_weekend_boundaries(self):
        for day in ['2026-10-31','2026-11-01']:
            for clock,active in [('05:59:59',False),('06:00:00',True),('23:58:59',True),('23:59:00',False)]:
                self.assertEqual(t.schedule(SCHEDULE,day+'T'+clock+'+07:00'),active)
    def test_inactive_thursday_monday(self):
        for day in ['2026-10-29','2026-11-02']:
            self.assertFalse(t.schedule(SCHEDULE,day+'T20:00:00+07:00'))
    def test_utc_converted_to_vietnam(self):
        self.assertTrue(t.schedule(SCHEDULE,'2026-10-30T12:00:00Z'))
        self.assertFalse(t.schedule(SCHEDULE,'2026-10-30T11:59:59Z'))
    def test_disjoint_groups_and_multiple_intervals(self):
        self.assertTrue(t.schedule('Mo-Fr 07:00-09:00,16:00-18:00; Sa-Su 10:00-12:00','2026-10-31T11:00:00+07:00'))
    def test_overlap_never_union(self):
        for text in ['Mo-Sa 07:00-09:00; We 16:00-18:00','Fr 07:00-09:00; Fr 16:00-18:00','Fr-Mo 07:00-09:00; Mo 10:00-12:00']:
            with self.assertRaises(ValueError):t.schedule(text,'2026-10-30T08:00:00+07:00')
    def test_multi_group_overnight_pending(self):
        with self.assertRaises(ValueError):t.schedule('Fr 22:00-02:00; Sa 06:00-08:00','2026-10-31T01:00:00+07:00')
        self.assertTrue(t.schedule('Fr 22:00-02:00','2026-10-31T01:00:00+07:00'))
    def test_unsupported_tail_even_when_first_group_active(self):
        for text in ['Fr 19:00-23:59; PH off','Fr 19:00-23:59;','Fr 19:00-23:59; Sa 25:00-26:00','19:00-23:59; Sa 06:00-23:59']:
            with self.assertRaises(ValueError):t.schedule(text,'2026-10-30T20:00:00+07:00')
    def test_single_conditional_pair_preserved(self):
        rules,_=tr.load_rules()
        self.assertEqual(t.conditional('no_left_turn @ ('+SCHEDULE+')','2026-10-30T20:00:00+07:00',rules),('no_left_turn',True))
        with self.assertRaises(ValueError):t.conditional('no_left_turn @ (Fr 19:00-23:59); no_right_turn @ (Sa 06:00-23:59)','2026-10-30T20:00:00+07:00',rules)
    def test_via_way_active_and_inactive(self):
        es={('node',n):{'type':'node','id':n} for n in [1,2,3,4]}
        for wid,ns in [(10,[1,2]),(20,[2,3]),(30,[3,4])]:es['way',wid]={'type':'way','id':wid,'nodes':ns}
        rel={'type':'relation','id':16733522,'tags':{'type':'restriction','restriction:conditional':'no_left_turn @ ('+SCHEDULE+')'},'members':[{'type':'way','ref':10,'role':'from'},{'type':'way','ref':20,'role':'via'},{'type':'way','ref':30,'role':'to'}]}
        original=copy.deepcopy(rel);rules,_=tr.load_rules()
        for at,status in [('2026-10-29T08:00:00+07:00','inactive_at_time'),('2026-10-30T20:00:00+07:00','ready')]:
            rs=v.evaluate_at([rel],es,rules,at);r=next(r for r in rs if r['profile']=='car');self.assertEqual(r['status'],status)
            if status=='ready':
                chain=r['sequence_patterns'][0]['segments'];check=v.RestrictionMachine(rs,'car').advance(chain[:-1],chain[-1]);self.assertEqual(check['state'],'forbidden')
        self.assertEqual(original,rel)
    def test_speed_inherits_day_groups_with_cap(self):
        cfg,_=bs.load_config();tags={'highway':'primary','maxspeed':'25','maxspeed:conditional':'10 @ ('+SCHEDULE+')'}
        self.assertEqual(bs.speed(tags,'car','forward',cfg,'2026-10-30T20:00:00+07:00')['effective_kmh'],10)
        self.assertEqual(bs.speed(tags,'car','forward',cfg,'2026-10-29T08:00:00+07:00')['effective_kmh'],25)
    def test_every_minute_of_week_matches_disjoint_schedule(self):
        start=datetime(2026,10,26,tzinfo=timezone(timedelta(hours=7)))
        for n in range(7*24*60):
            at=start+timedelta(minutes=n);minute=at.hour*60+at.minute
            expected=(at.weekday()==4 and 1140<=minute<1439) or (at.weekday() in [5,6] and 360<=minute<1439)
            self.assertEqual(t.schedule(SCHEDULE,at),expected)

if __name__=='__main__':unittest.main()
