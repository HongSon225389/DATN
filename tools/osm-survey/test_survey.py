import copy
import csv
import io
import json
from pathlib import Path
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr

import survey


class SurveyTests(unittest.TestCase):
    def setUp(self):
        self.fixture = Path(__file__).parent / "examples" / "synthetic-fixture.json"
        self.raw = self.fixture.read_bytes()
        self.data, self.elements = survey.parse_data(self.raw)
        self.box = survey.DEFAULT_BBOX
        self.result = survey.summarize(self.data, self.elements, self.box, survey.padded_bbox(self.box, 2))

    def test_denominator_excludes_area_missing_and_dependency(self):
        row = next(r for r in self.result["summary"]
                   if r["scope"] == "study_intersection" and r["metric"] == "linear_highway_ways")
        self.assertEqual(row["count"], 4)
        tag = next(r for r in self.result["summary"]
                   if r["scope"] == "study_intersection" and r["metric"] == "tag:maxspeed")
        self.assertEqual((tag["count"], tag["denominator"], tag["percent"]), (3, 4, 75))

    def test_mph_and_unresolved_speed(self):
        self.assertAlmostEqual(survey.parse_speed("20 mph"), 32.18688)
        for value in ["walk", "signals", "VN:urban", "30;50", "30 @ (wet)", "0", "-10", "nan", None]:
            self.assertIsNone(survey.parse_speed(value))

    def test_missing_nodes_never_create_fabricated_line(self):
        ids = {f["properties"]["osm_way_id"] for f in self.result["roads"]["features"]}
        self.assertNotIn(105, ids)
        self.assertTrue(any(i["osm_id"] == 105 and i["issue"] == "incomplete_geometry" for i in self.result["issues"]))

    def test_dependency_not_counted_in_download(self):
        row = next(r for r in self.result["rows"] if r["osm_way_id"] == 107)
        self.assertEqual(row["scope"], "dependency_outside")
        self.assertFalse(row["candidate"])

    def test_relations_preserve_exception_and_complex_members(self):
        rel = {r["id"]: r for r in self.result["restrictions"]}
        self.assertEqual(rel[201]["tags"]["except"], "foot")
        self.assertTrue(rel[201]["simple_via_node_shape"])
        self.assertFalse(rel[202]["simple_via_node_shape"])
        self.assertFalse(rel[203]["members_complete"])
        self.assertFalse(rel[201]["routing_rule_evaluated"])
        self.assertTrue(any(i["issue"] == "missing_relation_member" for i in self.result["issues"]))

    def test_overpass_partial_payload_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Overpass"):
            survey.parse_data(json.dumps({"elements": [], "remark": "runtime timeout"}))

    def test_deduplicates_and_rejects_conflicting_duplicates(self):
        data = copy.deepcopy(self.data)
        data["elements"].append(copy.deepcopy(data["elements"][0]))
        _, elements = survey.parse_data(json.dumps(data))
        self.assertEqual(len(elements), len(self.elements))
        data["elements"][-1]["lat"] = 0
        with self.assertRaises(ValueError):
            survey.parse_data(json.dumps(data))

    def test_crossing_segment_detected_even_without_inner_points(self):
        self.assertTrue(survey.intersects_box([[105.7, 21.0], [105.9, 21.0]], self.box))
        self.assertFalse(survey.intersects_box([[105.7, 22.0], [105.9, 22.0]], self.box))

    def test_bbox_buffer_and_query(self):
        download = survey.padded_bbox(self.box, 2)
        self.assertLess(download[0], self.box[0])
        self.assertGreater(download[3], self.box[3])
        query = survey.build_query(download, 90)
        self.assertIn('rel(bw.roads)["type"="restriction"]', query)
        self.assertIn('>>;', query)
        self.assertIn('out body;', query)
        with self.assertRaises(ValueError):
            survey.validate_bbox([106, 21, 105, 22])

    def test_empty_input_has_blank_percent_not_division_by_zero(self):
        data, elements = survey.parse_data('{"elements":[]}')
        result = survey.summarize(data, elements, self.box, self.box)
        self.assertTrue(all(r["percent"] == "" for r in result["summary"]))

    def test_offline_cli_reproducible_and_csv_quotes_vietnamese(self):
        with tempfile.TemporaryDirectory() as tmp, redirect_stdout(io.StringIO()):
            args = ["--input", str(self.fixture), "--output", tmp]
            self.assertEqual(survey.main(args), 0)
            self.assertEqual(survey.main(args), 0)
            runs = sorted(Path(tmp).iterdir())
            self.assertEqual(len(runs), 2)
            metadata = [json.loads((r/"metadata.json").read_text()) for r in runs]
            self.assertEqual(metadata[0]["raw_sha256"], metadata[1]["raw_sha256"])
            self.assertEqual(metadata[0]["status"], "completed")
            self.assertTrue(metadata[0]["completeness_warning"])
            self.assertFalse(metadata[0]["input_coverage_verified"])
            self.assertEqual((runs[0]/"osm-raw.json").read_bytes(), self.raw)
            with (runs[0]/"roads.csv").open(encoding="utf-8-sig", newline="") as f:
                row = next(csv.DictReader(f))
                self.assertEqual(row["name"], "Đường thử, không có thực")

    def test_failed_offline_run_marks_metadata_and_no_summary(self):
        with tempfile.TemporaryDirectory() as tmp, redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            root = Path(tmp)
            bad = root/"bad.json"
            bad.write_text('{"remark":"timeout","elements":[]}')
            self.assertEqual(survey.main(["--input", str(bad), "--output", str(root/"out")]), 1)
            run = next((root/"out").iterdir())
            self.assertEqual(json.loads((run/"metadata.json").read_text())["status"], "failed")
            self.assertFalse((run/"survey-summary.csv").exists())

    def test_csv_external_text_is_not_formula(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)/"test.csv"
            survey.write_csv(p, ["text", "number"], [{"text": " =1+1", "number": -1}])
            with p.open(encoding="utf-8-sig", newline="") as f:
                row = next(csv.DictReader(f))
                self.assertEqual(row["text"], "' =1+1")
                self.assertEqual(row["number"], "-1")


if __name__ == "__main__":
    unittest.main()
