"""handoff-ledger Python CLI. `python -m handoff_ledger <cmd>` or the `handoff-ledger-py` entry point."""
import argparse
import json
import os
import sys

from . import belieflog, docset
from .manifest import load_manifest, drift_check


def _out(obj, human, as_json):
    if as_json:
        print(json.dumps(obj, indent=2))
    else:
        print(human)


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    p = argparse.ArgumentParser(prog="handoff-ledger", add_help=True)
    p.add_argument("--json", action="store_true")
    sub = p.add_subparsers(dest="cmd")

    bv = sub.add_parser("belief-validate"); bv.add_argument("log")
    ba = sub.add_parser("belief-append")
    ba.add_argument("log")
    for f in ("kind", "trace", "span", "belief", "from", "to", "trigger", "status", "note", "phase"):
        ba.add_argument("--" + f, dest=f.replace("from", "from_"))
    ba.add_argument("--confidence", type=float); ba.add_argument("--risk", type=float)
    ba.add_argument("--evidence"); ba.add_argument("--allow-clock-skew", action="store_true")

    dc = sub.add_parser("drift-check"); dc.add_argument("--manifest", default="manifest.json")
    dcmp = sub.add_parser("docset-cmp"); dcmp.add_argument("a"); dcmp.add_argument("b")

    args = p.parse_args(argv)

    if args.cmd == "belief-validate":
        r = belieflog.validate_file(args.log)
        failures = [{"n": n, "errors": e} for (n, ok, e) in r["lines"] if not ok]
        human = "OK: %d line(s) valid." % len(r["lines"]) if r["valid"] else "INVALID: %d bad line(s)." % len(failures)
        for fobj in failures:
            human += "\n  line %d: %s" % (fobj["n"], "; ".join(fobj["errors"]))
        _out({"valid": r["valid"], "failures": failures, "appendOnlyWarnings": r["append_only_warnings"]}, human, args.json)
        return 0 if r["valid"] else 1

    if args.cmd == "belief-append":
        entry = {}
        for k in ("kind", "trace", "span", "belief", "to", "trigger", "status", "note", "phase"):
            v = getattr(args, k, None)
            if v is not None:
                entry[k] = v
        if getattr(args, "from_", None) is not None:
            entry["from"] = args.from_
        if args.confidence is not None:
            entry["confidence"] = args.confidence
        if args.risk is not None:
            entry["risk"] = args.risk
        if args.evidence:
            entry["evidence"] = [x.strip() for x in args.evidence.split(",") if x.strip()]
        w = belieflog.append(args.log, entry, allow_clock_skew=args.allow_clock_skew)
        _out({"appended": w}, "appended to %s: %s / %s" % (args.log, w["kind"], w["span"]), args.json)
        return 0

    if args.cmd == "drift-check":
        if not os.path.exists(args.manifest):
            sys.stderr.write("error: manifest not found: %s\n" % args.manifest); return 1
        m = load_manifest(args.manifest)
        verdicts, ok = drift_check(m, os.path.dirname(os.path.abspath(args.manifest)))
        human = "drift-check @ %s — %s" % (m["docsetVersion"], "ALL IN SYNC" if ok else "DRIFT DETECTED")
        for i, v in verdicts.items():
            human += "\n  %s %s: %s" % ("v" if v == "IN_SYNC" else "x", i, v)
        _out({"docsetVersion": m["docsetVersion"], "ok": ok, "verdicts": verdicts}, human, args.json)
        return 0 if ok else 1

    if args.cmd == "docset-cmp":
        c = docset.compare_docset(args.a, args.b)
        _out({"a": args.a, "b": args.b, "cmp": c}, str(c), args.json)
        return 0

    p.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
