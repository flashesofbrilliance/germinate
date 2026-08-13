"""Docset version ordering — SPEC.md §4. Format: YYYY-MM-DD-<phase>.<n>."""
import re

DOCSET_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})-([A-Za-z0-9]+)\.(\d+)$")


def parse_docset(v):
    m = DOCSET_RE.match(v or "")
    if not m:
        raise ValueError("invalid docset version: %r" % (v,))
    return {"date": "%s-%s-%s" % (m.group(1), m.group(2), m.group(3)),
            "phase": m.group(4), "n": int(m.group(5))}


def compare_docset(a, b):
    """Return -1 if a<b, 0 if equal, 1 if a>b."""
    pa, pb = parse_docset(a), parse_docset(b)
    if pa["date"] != pb["date"]:
        return -1 if pa["date"] < pb["date"] else 1
    if pa["phase"] != pb["phase"]:
        return -1 if pa["phase"] < pb["phase"] else 1
    if pa["n"] != pb["n"]:
        return -1 if pa["n"] < pb["n"] else 1
    return 0
