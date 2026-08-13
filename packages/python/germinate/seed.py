"""Seed layer. SPEC.md §9. Deterministic v0.1 surfacer (literal tag-set intersection;
visible antipattern veto; git-path staleness). No NLP/LLM. Mirrors packages/node/src/seed.js.
stdlib only — a minimal YAML-subset frontmatter parser (no pyyaml)."""
import os
import re

_FM_RE = re.compile(r"^---\n(.*?)\n---\n?(.*)$", re.DOTALL)
_KV_RE = re.compile(r"^([A-Za-z0-9_]+):\s*(.*)$")
_SUB_RE = re.compile(r"^\s+([A-Za-z0-9_]+):\s*(.*)$")
_ITEM_RE = re.compile(r"^\s+-\s+(.*)$")
_SECRET_RE = re.compile(r"(case[-_ ]?\d{3,}|gdoc:|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b[A-Z]{2,}-\d{2,}\b)")


def _scalar(v):
    v = v.strip()
    if v == "":
        return ""
    if v == "true":
        return True
    if v == "false":
        return False
    if re.match(r"^-?\d+$", v):
        return int(v)
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        return v[1:-1]
    return v


def _inline_list(v):
    return [x for x in (_scalar(s) for s in v[1:-1].split(",")) if x != ""]


def parse_frontmatter(text):
    m = _FM_RE.match(text)
    if not m:
        return {}, text
    body = m.group(2)
    lines = m.group(1).split("\n")
    fm = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue
        kv = _KV_RE.match(line)
        if not kv:
            i += 1
            continue
        key, rest = kv.group(1), kv.group(2)
        if rest == "":
            block, nested = [], {}
            is_list = is_map = False
            j = i + 1
            while j < len(lines) and re.match(r"^\s+\S", lines[j]):
                item = _ITEM_RE.match(lines[j])
                sub = _SUB_RE.match(lines[j])
                if item:
                    is_list = True
                    block.append(_scalar(item.group(1)))
                elif sub:
                    is_map = True
                    val = sub.group(2)
                    nested[sub.group(1)] = _inline_list(val) if val.startswith("[") else _scalar(val)
                j += 1
            fm[key] = block if is_list else (nested if is_map else "")
            i = j
        elif rest.startswith("[") and rest.endswith("]"):
            fm[key] = _inline_list(rest)
            i += 1
        else:
            fm[key] = _scalar(rest)
            i += 1
    return fm, body


def tokenize(s):
    return set(t for t in re.split(r"[^a-z0-9]+", str(s or "").lower()) if t)


def phrase_matches(phrase, context_tokens):
    t = tokenize(phrase)
    return len(t) > 0 and t.issubset(context_tokens)


def load_seeds_from_dir(directory, is_global):
    if not directory or not os.path.isdir(directory):
        return []
    seeds = []
    for f in sorted(os.listdir(directory)):
        if not f.endswith(".md"):
            continue
        p = os.path.join(directory, f)
        with open(p, encoding="utf-8") as fh:
            fm, body = parse_frontmatter(fh.read())
        if fm.get("kind") != "seed":
            continue
        seeds.append({
            "id": fm.get("id") or os.path.splitext(f)[0],
            "path": p, "isGlobal": is_global, "fm": fm, "body": body,
            "soil": fm.get("soil") or [], "tags": fm.get("tags") or [],
            "antipatterns": fm.get("antipatterns") or [], "global": bool(fm.get("global")),
        })
    return seeds


def sprout(banks, ctx):
    cwd = ctx.get("cwd") or os.getcwd()
    context_tokens = tokenize(ctx.get("contextStr")) | tokenize(cwd) | tokenize(ctx.get("trace"))

    seeds = load_seeds_from_dir(banks.get("localDir"), False)
    shadowed = []
    if ctx.get("includeGlobal"):
        local_ids = {s["id"] for s in seeds}
        for g in load_seeds_from_dir(banks.get("globalDir"), True):
            if g["id"] in local_ids:
                shadowed.append(g["id"])
                continue
            if ctx.get("trace") and g["global"]:
                if not any(str(ctx["trace"]).lower() in tokenize(s) for s in g["soil"]):
                    continue
            seeds.append(g)

    surfaced, suppressed, stale, dormant = [], [], [], []
    for s in seeds:
        matched_soil = [x for x in s["soil"] if phrase_matches(x, context_tokens)]
        matched_tags = [x for x in s["tags"] if phrase_matches(x, context_tokens)]
        score = len(matched_soil) + len(matched_tags)
        matched_anti = [x for x in s["antipatterns"] if phrase_matches(x, context_tokens)]
        stale_paths = [x for x in s["soil"] if "/" in str(x) and not os.path.exists(os.path.join(cwd, x))]
        rec = {"id": s["id"], "path": s["path"], "isGlobal": s["isGlobal"], "score": score,
               "matchedSoil": matched_soil, "matchedTags": matched_tags}
        if matched_anti:
            suppressed.append({**rec, "suppressedBy": matched_anti})
        elif score > 0 and stale_paths:
            stale.append({**rec, "stalePaths": stale_paths})
        elif score > 0:
            surfaced.append(rec)
        else:
            dormant.append({"id": s["id"], "path": s["path"], "isGlobal": s["isGlobal"]})
    surfaced.sort(key=lambda r: (-r["score"], r["id"]))
    return {"surfaced": surfaced, "suppressed": suppressed, "stale": stale, "dormant": dormant, "shadowed": shadowed}


def lint_seed(text):
    fm, _ = parse_frontmatter(text)
    warnings = []

    def scan(label, val):
        if isinstance(val, list):
            s = " ".join(str(x) for x in val)
        elif isinstance(val, dict):
            s = " ".join(f"{k} {v}" for k, v in val.items())
        else:
            s = str(val or "")
        if _SECRET_RE.search(s):
            warnings.append(f"{label} contains a likely internal identifier (redact via a rosetta handle before publishing to the global bank)")

    scan("soil", fm.get("soil"))
    scan("provenance", fm.get("provenance"))
    scan("antipatterns", fm.get("antipatterns"))
    if fm.get("global") and not fm.get("soil"):
        warnings.append("global seed with empty soil will match nothing / everything ambiguously — scope its soil")
    return {"ok": len(warnings) == 0, "warnings": warnings}
