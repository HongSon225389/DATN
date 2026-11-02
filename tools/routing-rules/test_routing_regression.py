import unittest
import test_experimental_router as fixture
from experimental_router import Router
from routing_regression import evaluate
class RegressionTests(unittest.TestCase):
 def test_distance_expectation_and_failure(self):
  f=fixture.ExperimentalRouterTests();g=f.graph();case={'case_id':'one','start':f.point(g,1),'end':f.point(g,3)};r=Router(g)
  self.assertTrue(evaluate(r,case,{'state':'found','length_m':20})['passed'])
  self.assertFalse(evaluate(r,case,{'state':'found','length_m':40})['passed'])
 def test_wrong_state_fails(self):
  f=fixture.ExperimentalRouterTests();g=f.graph();case={'case_id':'one','start':f.point(g,1),'end':f.point(g,3)}
  self.assertFalse(evaluate(Router(g),case,{'state':'no_route'})['passed'])
