"""Runs the language-neutral conformance suite against the Python impl. Plain unittest, stdlib only."""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
CONF = os.path.abspath(os.path.join(HERE, "../../../conformance"))

from germinate import belieflog, docset  # noqa: E402
from germinate import seed as seedlib  # noqa: E402
from germinate.manifest import load_manifest, drift_check  # noqa: E402

with open(os.path.join(CONF, "cases.json")) as f:
    CASES = json.load(f)


class Conformance(unittest.TestCase):
    def test_belief_line_validation(self):
        for c in CASES["beliefLogLineValidation"]:
            r = belieflog.validate_file(os.path.join(CONF, c["file"]))
            self.assertEqual(r["valid"], c["valid"], c["file"])

    def test_docset_ordering(self):
        for c in CASES["docsetOrdering"]:
            self.assertEqual(docset.compare_docset(c["a"], c["b"]), c["cmp"], (c["a"], c["b"]))

    def test_drift_check(self):
        for c in CASES["driftCheck"]:
            m = load_manifest(os.path.join(CONF, c["manifest"]))
            verdicts, ok = drift_check(m, os.path.dirname(os.path.join(CONF, c["manifest"])))
            self.assertEqual(ok, c["expectExitZero"], c["manifest"])
            for i, v in c["verdicts"].items():
                self.assertEqual(verdicts[i], v, (c["manifest"], i))


class SeedSprout(unittest.TestCase):
    def test_sprout(self):
        spec = CASES.get("seedSprout")
        if not spec:
            return
        bank = os.path.join(CONF, spec["bank"])
        for c in spec["cases"]:
            res = seedlib.sprout({"localDir": bank, "globalDir": None},
                                 {"contextStr": c["context"], "cwd": CONF, "includeGlobal": False})
            ids = lambda arr: [x["id"] for x in arr]
            self.assertEqual(ids(res["surfaced"]), c["surfaced"], ("surfaced", c["context"]))
            self.assertEqual(sorted(ids(res["suppressed"])), sorted(c["suppressed"]), ("suppressed", c["context"]))
            self.assertEqual(sorted(ids(res["stale"])), sorted(c["stale"]), ("stale", c["context"]))


class AppendOnly(unittest.TestCase):
    def test_append_rejects_invalid(self):
        import tempfile
        f = os.path.join(tempfile.mkdtemp(), "a.jsonl")
        with self.assertRaises(ValueError):
            belieflog.append(f, {"trace": "t", "span": "s", "kind": "belief.open"})

    def test_append_only_ts_guard(self):
        import tempfile
        from datetime import datetime, timezone
        f = os.path.join(tempfile.mkdtemp(), "b.jsonl")
        belieflog.append(f, {"trace": "t", "span": "s", "kind": "note", "note": "x"},
                         now=datetime(2026, 8, 13, 10, tzinfo=timezone.utc))
        with self.assertRaises(ValueError):
            belieflog.append(f, {"trace": "t", "span": "s", "kind": "note", "note": "y",
                                 "ts": "2026-08-13T09:00:00+00:00"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
