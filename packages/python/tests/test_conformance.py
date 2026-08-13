"""Runs the language-neutral conformance suite against the Python impl. Plain unittest, stdlib only."""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
CONF = os.path.abspath(os.path.join(HERE, "../../../conformance"))

from handoff_ledger import belieflog, docset  # noqa: E402
from handoff_ledger.manifest import load_manifest, drift_check  # noqa: E402

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
            verdicts, ok = drift_check(m, CONF)
            self.assertEqual(ok, c["expectExitZero"], c["manifest"])
            for i, v in c["verdicts"].items():
                self.assertEqual(verdicts[i], v, (c["manifest"], i))


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
