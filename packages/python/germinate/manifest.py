"""Manifest + drift-check. SPEC.md §3. stdlib only."""
import json
import os

from .docset import compare_docset


def load_manifest(path):
    with open(path, "r", encoding="utf-8") as f:
        obj = json.load(f)
    if not obj.get("docsetVersion"):
        raise ValueError("manifest missing docsetVersion")
    if not isinstance(obj.get("surfaces"), list):
        raise ValueError("manifest missing surfaces[]")
    seen = set()
    for s in obj["surfaces"]:
        if not s.get("id"):
            raise ValueError("surface missing id")
        if s["id"] in seen:
            raise ValueError("duplicate surface id: %s" % s["id"])
        seen.add(s["id"])
    return obj


def drift_check(manifest, base_dir):
    """Return (verdicts: dict, ok: bool)."""
    verdicts = {}
    for s in manifest["surfaces"]:
        if compare_docset(s["docset"], manifest["docsetVersion"]) < 0:
            v = "STALE"
        elif s["kind"] == "projection" and s.get("status") and s["status"] != "IN_SYNC":
            v = "OUT_OF_SYNC"
        elif s["kind"] == "canonical" and not os.path.exists(os.path.join(base_dir, s.get("path", ""))):
            v = "MISSING"
        else:
            v = "IN_SYNC"
        verdicts[s["id"]] = v
    return verdicts, all(v == "IN_SYNC" for v in verdicts.values())
