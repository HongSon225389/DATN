from pathlib import Path
import tempfile
import unittest
import build_graph as bg
import compare_graph_versions as c

class CompareVersionsTests(unittest.TestCase):
    def fixture(self,root,name,version,unlocated,status):
        run=root/name;run.mkdir();hashes={}
        for profile in ['car','motorcycle','walking']:
            graph={'graph_version':version,'profile':profile,'nodes':{},'edges':{},'turn_records':[{'relation_id':1,'status':status}],'unlocated_pending_turn_relations':unlocated,'strict_coverage_complete':not unlocated}
            path=run/(profile+'.graph.json.gz');bg.write_json(path,graph);hashes[path.name]=c.hashlib.sha256(path.read_bytes()).hexdigest()
        bg.write_json(run/'metadata.json',{'status':'completed','graph_version':version,'dataset_version':'test','raw_sha256':'test','scope':'study','evaluated_at':'2026-10-29T08:00:00+07:00','output_sha256':hashes});return run
    def test_comparison_records_changes_without_mutation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);a=self.fixture(root,'old','a',[1],'unresolved');b=self.fixture(root,'new','b',[],'inactive_at_time')
            before=(a/'car.graph.json.gz').read_bytes();run,rows,changes=c.compare(a,b,root/'out')
            self.assertEqual(len(changes),3);self.assertTrue(all(r['edges_identical'] for r in rows));self.assertEqual((a/'car.graph.json.gz').read_bytes(),before);self.assertTrue((run/'turn-changes.csv').exists())
    def test_hash_or_different_time_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);a=self.fixture(root,'old','a',[1],'unresolved');b=self.fixture(root,'new','b',[],'inactive_at_time')
            meta=bg.read_json(b/'metadata.json');meta['evaluated_at']='different';bg.write_json(b/'metadata.json',meta)
            with self.assertRaises(ValueError):c.compare(a,b,root/'out')
            meta['evaluated_at']=bg.read_json(a/'metadata.json')['evaluated_at'];bg.write_json(b/'metadata.json',meta);(b/'car.graph.json.gz').write_bytes(b'bad')
            with self.assertRaises(ValueError):c.compare(a,b,root/'out')

if __name__=='__main__':unittest.main()
