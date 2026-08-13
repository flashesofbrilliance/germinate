#!/usr/bin/env sh
# handoff-ledger — POSIX shell implementation.
# Zero hard dependencies for the git-native verbs (serializability, install-hooks, belief append).
# JSON verbs (belief validate, drift-check) use `jq` when available and degrade with a clear message.
# Conformant against ../../conformance/cases.json (see hooks/ and completions/ for extras).
set -eu

HL_VERSION="0.1.0"
PROG="$(basename "$0")"

_has() { command -v "$1" >/dev/null 2>&1; }
_die() { printf 'error: %s\n' "$*" >&2; exit 1; }
_warn() { printf '  ! %s\n' "$*" >&2; }

DOCSET_RE='^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-[A-Za-z0-9][A-Za-z0-9]*\.[0-9][0-9]*$'

usage() {
  cat <<EOF
handoff-ledger v$HL_VERSION (shell) — serializable, provenance-carrying handoff protocol.

USAGE
  $PROG <command> [options]

COMMANDS
  serializability [--manifest <m.json>] [--strict]  Warn on force-push risk / untracked shared state. (pure git)
  install-hooks                                     Install the git pre-push serializability hook.
  belief append <log.jsonl> --kind K --trace T --span S [--belief .. --confidence .. --risk .. ...]
  belief validate <log.jsonl>                       Validate belief-log (needs jq).
  drift-check [--manifest <m.json>] [--strict]      Are projections in sync with the docset? (needs jq)
  docset-cmp <a> <b>                                Compare two docset versions (-1/0/1).
  version | help
EOF
}

# ---- docset comparison (pure shell) ----
docset_cmp() {
  a="$1"; b="$2"
  echo "$a" | grep -Eq "$DOCSET_RE" || _die "invalid docset: $a"
  echo "$b" | grep -Eq "$DOCSET_RE" || _die "invalid docset: $b"
  # split date | phase | n
  ad=$(echo "$a" | sed -E 's/^([0-9-]{10})-.*/\1/'); an=$(echo "$a" | sed -E 's/.*\.([0-9]+)$/\1/'); ap=$(echo "$a" | sed -E 's/^[0-9-]{10}-([A-Za-z0-9]+)\..*/\1/')
  bd=$(echo "$b" | sed -E 's/^([0-9-]{10})-.*/\1/'); bn=$(echo "$b" | sed -E 's/.*\.([0-9]+)$/\1/'); bp=$(echo "$b" | sed -E 's/^[0-9-]{10}-([A-Za-z0-9]+)\..*/\1/')
  if [ "$ad" != "$bd" ]; then [ "$ad" \< "$bd" ] && echo -1 || echo 1; return; fi
  if [ "$ap" != "$bp" ]; then [ "$ap" \< "$bp" ] && echo -1 || echo 1; return; fi
  if [ "$an" -lt "$bn" ]; then echo -1; elif [ "$an" -gt "$bn" ]; then echo 1; else echo 0; fi
}

# ---- serializability (pure git) — SPEC.md §6 ----
serializability() {
  manifest="manifest.json"; strict=0
  while [ $# -gt 0 ]; do case "$1" in
    --manifest) manifest="$2"; shift 2;;
    --strict) strict=1; shift;;
    *) shift;;
  esac; done

  clean=1
  top=$(git rev-parse --show-toplevel 2>/dev/null || true)
  if [ -z "$top" ]; then
    _warn "not inside a git repository; the serialized surface has no lock at all here."
    clean=0
  else
    if up=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null); then
      behind=$(git rev-list --count 'HEAD..@{upstream}' 2>/dev/null || echo 0)
      if [ "${behind:-0}" -gt 0 ]; then
        _warn "branch is behind upstream by $behind commit(s): a push would need --force and could drop commits (lost-update hazard)."
        clean=0
      fi
    else
      _warn "no upstream configured for the current branch; cannot assess force-push risk."
    fi
    # untracked shared state: manifest canonical paths not tracked by git
    if [ -f "$manifest" ] && _has jq; then
      jq -r '.surfaces[] | select(.kind=="canonical") | [.id, .path] | @tsv' "$manifest" 2>/dev/null | while IFS="$(printf '\t')" read -r id p; do
        [ -n "$p" ] || continue
        if ! git ls-files --error-unmatch "$p" >/dev/null 2>&1; then
          _warn "surface $id ($p) is a canonical SSOT but is NOT git-tracked: git will not protect it from lost updates."
        fi
      done
      # dangling projections (no source)
      jq -r '.surfaces[] | select(.kind=="projection") | select((.source|length)==0 or (has("source")|not)) | .id' "$manifest" 2>/dev/null | while read -r id; do
        [ -n "$id" ] && _warn "projection $id has no source[]: advisory surface with no canonical origin."
      done
      # recompute clean if any untracked found
      if jq -e '.surfaces[] | select(.kind=="canonical")' "$manifest" >/dev/null 2>&1; then
        for p in $(jq -r '.surfaces[] | select(.kind=="canonical") | .path' "$manifest" 2>/dev/null); do
          git ls-files --error-unmatch "$p" >/dev/null 2>&1 || clean=0
        done
      fi
    fi
  fi

  if [ "$clean" -eq 1 ]; then echo "serializability — CLEAN"; else echo "serializability — WARNINGS"; fi
  if [ "$strict" -eq 1 ] && [ "$clean" -ne 1 ]; then return 1; fi
  return 0
}

install_hooks() {
  top=$(git rev-parse --show-toplevel 2>/dev/null) || _die "not inside a git repository"
  hook="$top/.git/hooks/pre-push"
  cat > "$hook" <<'HOOK'
#!/bin/sh
# installed by handoff-ledger — serializability guard
if command -v handoff-ledger >/dev/null 2>&1; then exec handoff-ledger serializability --strict
elif command -v hl >/dev/null 2>&1; then exec hl serializability --strict
else echo "handoff-ledger not on PATH; skipping serializability guard" >&2; exit 0; fi
HOOK
  chmod +x "$hook"
  echo "installed pre-push hook: $hook"
}

# ---- belief append (pure shell JSON emit) — SPEC.md §2 ----
json_str() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
belief_append() {
  log="$1"; shift
  [ -n "${log:-}" ] || _die "usage: belief append <log.jsonl> --kind K --trace T --span S ..."
  kind=""; trace=""; span=""; belief=""; from=""; to=""; trigger=""; status=""; note=""; phase=""; confidence=""; risk=""; evidence=""
  while [ $# -gt 0 ]; do case "$1" in
    --kind) kind="$2"; shift 2;; --trace) trace="$2"; shift 2;; --span) span="$2"; shift 2;;
    --belief) belief="$2"; shift 2;; --from) from="$2"; shift 2;; --to) to="$2"; shift 2;;
    --trigger) trigger="$2"; shift 2;; --status) status="$2"; shift 2;; --note) note="$2"; shift 2;;
    --phase) phase="$2"; shift 2;; --confidence) confidence="$2"; shift 2;; --risk) risk="$2"; shift 2;;
    --evidence) evidence="$2"; shift 2;; *) shift;;
  esac; done
  [ -n "$kind" ] || _die "belief append requires --kind"
  [ -n "$trace" ] || _die "belief append requires --trace"
  [ -n "$span" ] || _die "belief append requires --span"
  [ "$kind" = "belief.open" ] && [ -z "$belief" ] && _die "belief.open requires --belief"
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  # append-only ts guard
  if [ -f "$log" ] && [ -s "$log" ]; then
    last_ts=$(tail -n 1 "$log" | sed -E 's/.*"ts":"([^"]+)".*/\1/')
    if [ -n "$last_ts" ] && [ "$ts" \< "$last_ts" ]; then _die "append-only: ts $ts precedes last $last_ts"; fi
  fi
  out="{\"ts\":\"$ts\",\"trace\":\"$(json_str "$trace")\",\"span\":\"$(json_str "$span")\",\"kind\":\"$kind\""
  [ -n "$phase" ] && out="$out,\"phase\":\"$(json_str "$phase")\""
  [ -n "$belief" ] && out="$out,\"belief\":\"$(json_str "$belief")\""
  [ -n "$from" ] && out="$out,\"from\":\"$(json_str "$from")\""
  [ -n "$to" ] && out="$out,\"to\":\"$(json_str "$to")\""
  [ -n "$trigger" ] && out="$out,\"trigger\":\"$(json_str "$trigger")\""
  [ -n "$confidence" ] && out="$out,\"confidence\":$confidence"
  [ -n "$risk" ] && out="$out,\"risk\":$risk"
  [ -n "$note" ] && out="$out,\"note\":\"$(json_str "$note")\""
  if [ -n "$evidence" ]; then
    ev=$(printf '%s' "$evidence" | awk -F, '{for(i=1;i<=NF;i++){printf "%s\"%s\"", (i>1?",":""), $i}}')
    out="$out,\"evidence\":[$ev]"
  fi
  [ -n "$status" ] && out="$out,\"status\":\"$status\""
  out="$out}"
  # newline-safety
  if [ -f "$log" ] && [ -s "$log" ] && [ "$(tail -c1 "$log")" != "" ]; then printf '\n' >> "$log"; fi
  printf '%s\n' "$out" >> "$log"
  echo "appended to $log: $kind / $span"
}

belief_validate() {
  log="$1"
  [ -f "$log" ] || _die "no such file: $log"
  _has jq || _die "belief validate needs jq (or use the node/python CLI)"
  bad=0; n=0
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    n=$((n+1))
    if ! printf '%s' "$line" | jq -e . >/dev/null 2>&1; then echo "  line $n: not valid JSON"; bad=$((bad+1)); continue; fi
    k=$(printf '%s' "$line" | jq -r '.kind // empty')
    for req in ts trace span kind; do
      printf '%s' "$line" | jq -e "has(\"$req\")" >/dev/null 2>&1 || { echo "  line $n: missing $req"; bad=$((bad+1)); }
    done
    case "$k" in trace.open|belief.open|belief.update|belief.close|note) ;; *) echo "  line $n: bad kind: $k"; bad=$((bad+1));; esac
    [ "$k" = "belief.open" ] && ! printf '%s' "$line" | jq -e 'has("belief")' >/dev/null 2>&1 && { echo "  line $n: belief.open requires belief"; bad=$((bad+1)); }
    c=$(printf '%s' "$line" | jq -r '.confidence // empty')
    [ -n "$c" ] && awk "BEGIN{exit !($c<0 || $c>1)}" && { echo "  line $n: confidence out of [0,1]"; bad=$((bad+1)); }
  done < "$log"
  if [ "$bad" -eq 0 ]; then echo "OK: $n line(s) valid."; return 0; else echo "INVALID: $bad problem(s)."; return 1; fi
}

drift_check() {
  manifest="manifest.json"; strict=1
  while [ $# -gt 0 ]; do case "$1" in --manifest) manifest="$2"; shift 2;; --strict) shift;; *) shift;; esac; done
  [ -f "$manifest" ] || _die "manifest not found: $manifest"
  _has jq || _die "drift-check needs jq (or use the node/python CLI)"
  header=$(jq -r '.docsetVersion' "$manifest")
  base=$(dirname "$manifest")
  ok=1
  echo "drift-check @ $header"
  jq -r '.surfaces[] | [.id, .kind, .docset, (.path // ""), (.status // "")] | @tsv' "$manifest" | while IFS="$(printf '\t')" read -r id kind docset path status; do
    verdict="IN_SYNC"
    cmp=$(docset_cmp "$docset" "$header")
    if [ "$cmp" = "-1" ]; then verdict="STALE"
    elif [ "$kind" = "projection" ] && [ -n "$status" ] && [ "$status" != "IN_SYNC" ]; then verdict="OUT_OF_SYNC"
    elif [ "$kind" = "canonical" ] && [ ! -f "$base/$path" ]; then verdict="MISSING"; fi
    if [ "$verdict" = "IN_SYNC" ]; then echo "  ✓ $id: $verdict"; else echo "  ✗ $id: $verdict"; fi
  done
  # exit status: recompute (subshell above can't set parent var)
  drift=0
  for row in $(jq -r '.surfaces[] | [.id,.kind,.docset,(.path//""),(.status//"")] | @csv' "$manifest" | tr -d '"'); do :; done
  # simpler: re-evaluate with a jq one-pass boolean
  bad=$(jq -r --arg h "$header" '
    [ .surfaces[] |
      (.docset) as $d |
      if ($d < $h) then "STALE"
      elif (.kind=="projection" and (.status // "IN_SYNC") != "IN_SYNC") then "OOS"
      else "OK" end ] | map(select(.!="OK")) | length' "$manifest")
  # note: string < compare on docset is a coarse proxy; canonical MISSING handled in node/python.
  if [ "${bad:-0}" -gt 0 ]; then return 1; fi
  return 0
}

# ---- dispatch ----
cmd="${1:-help}"; [ $# -gt 0 ] && shift || true
case "$cmd" in
  serializability) serializability "$@";;
  install-hooks) install_hooks "$@";;
  drift-check) drift_check "$@";;
  docset-cmp) docset_cmp "$@";;
  belief)
    sub="${1:-}"; [ $# -gt 0 ] && shift || true
    case "$sub" in
      append) belief_append "$@";;
      validate) belief_validate "$@";;
      *) _die "usage: belief append|validate ...";;
    esac;;
  version|--version) echo "$HL_VERSION";;
  help|--help|"") usage;;
  *) printf 'unknown command: %s\n\n' "$cmd" >&2; usage; exit 2;;
esac
