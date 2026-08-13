"""Belief-log: validate + append. SPEC.md §2. Append-only, OTel-shaped JSONL. stdlib only."""
import json
import os
from datetime import datetime, timezone

KINDS = ["trace.open", "belief.open", "belief.update", "belief.close", "note"]
STATUSES = ["OPEN", "ALIGNED", "SUPERSEDED", "DEFERRED", "CLOSED"]


def _parse_ts(ts):
    if not isinstance(ts, str):
        return None
    s = ts.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def validate_line(obj):
    """Return (valid, errors)."""
    errors = []
    for k in ("ts", "trace", "span", "kind"):
        if obj.get(k) in (None, ""):
            errors.append("missing required field: %s" % k)
    for k in ("ts", "trace", "span", "belief", "from", "to", "trigger", "note", "phase"):
        if k in obj and obj[k] is not None and not isinstance(obj[k], str):
            errors.append("%s must be a string" % k)
    if isinstance(obj.get("ts"), str) and _parse_ts(obj["ts"]) is None:
        errors.append("ts must be an RFC 3339 / parseable date-time")
    if "kind" in obj and obj["kind"] not in KINDS:
        errors.append("kind not in enum: %s" % obj["kind"])
    for k in ("confidence", "risk"):
        if k in obj:
            v = obj[k]
            if not isinstance(v, (int, float)) or isinstance(v, bool) or v < 0 or v > 1:
                errors.append("%s must be a number in [0,1]" % k)
    if "evidence" in obj:
        ev = obj["evidence"]
        if not isinstance(ev, list) or not all(isinstance(e, str) for e in ev):
            errors.append("evidence must be an array of strings")
    if "status" in obj and obj["status"] not in STATUSES:
        errors.append("status not in enum: %s" % obj["status"])
    if obj.get("kind") == "belief.open" and obj.get("belief") in (None, ""):
        errors.append("belief.open requires belief")
    if obj.get("kind") == "note" and obj.get("note") in (None, ""):
        errors.append("note kind requires note")
    if obj.get("kind") == "trace.open" and obj.get("note") in (None, ""):
        errors.append("trace.open requires note")
    return (len(errors) == 0, errors)


def validate_file(path):
    """Return dict(valid, lines=[(n, valid, errors)], append_only_warnings=[])."""
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    results = []
    warnings = []
    last = None
    for i, line in enumerate((l for l in raw.split("\n") if l.strip()), start=1):
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            results.append((i, False, ["not valid JSON: %s" % e]))
            continue
        ok, errs = validate_line(obj)
        results.append((i, ok, errs))
        t = _parse_ts(obj.get("ts"))
        if t is not None:
            if last is not None and t < last:
                warnings.append("line %d: ts goes backwards (clock skew or out-of-order append)" % i)
            last = t
    return {"valid": all(r[1] for r in results), "lines": results, "append_only_warnings": warnings}


def append(path, entry, allow_clock_skew=False, now=None):
    obj = dict(entry)
    if not obj.get("ts"):
        obj["ts"] = (now or datetime.now(timezone.utc)).isoformat()
    ok, errs = validate_line(obj)
    if not ok:
        raise ValueError("refusing to append invalid line: " + "; ".join(errs))
    if os.path.exists(path) and os.path.getsize(path) > 0:
        with open(path, "r", encoding="utf-8") as f:
            existing = [l for l in f.read().split("\n") if l.strip()]
        if existing:
            last = json.loads(existing[-1])
            lt, ot = _parse_ts(last.get("ts")), _parse_ts(obj["ts"])
            if lt and ot and ot < lt and not allow_clock_skew:
                raise ValueError(
                    "refusing to append: ts %s precedes last line ts %s (append-only). "
                    "Pass allow_clock_skew to override." % (obj["ts"], last["ts"]))
    needs_nl = os.path.exists(path) and os.path.getsize(path) > 0
    if needs_nl:
        with open(path, "rb") as f:
            f.seek(-1, os.SEEK_END)
            needs_nl = f.read(1) != b"\n"
    with open(path, "a", encoding="utf-8") as f:
        if needs_nl:
            f.write("\n")
        f.write(json.dumps(obj, separators=(",", ":")) + "\n")
    return obj
