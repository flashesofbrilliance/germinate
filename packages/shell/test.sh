#!/usr/bin/env sh
# Conformance + smoke for the shell impl. Driven by ../../conformance/cases.json (docset + belief-log subset).
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
HL="$HERE/hl.sh"
CONF="$(cd "$HERE/../../conformance" && pwd)"
pass=0; fail=0
ok() { pass=$((pass+1)); }
no() { fail=$((fail+1)); printf '  FAIL: %s\n' "$1"; }

# docset ordering (from cases.json via jq if available, else inline the known cases)
if command -v jq >/dev/null 2>&1; then
  jq -r '.docsetOrdering[] | [.a,.b,.cmp] | @tsv' "$CONF/cases.json" | while IFS="$(printf '\t')" read -r a b want; do
    got=$(sh "$HL" docset-cmp "$a" "$b")
    [ "$got" = "$want" ] && printf '  ok docset %s %s = %s\n' "$a" "$b" "$got" || printf '  FAIL docset %s %s want %s got %s\n' "$a" "$b" "$want" "$got"
  done
fi

# docset-cmp direct assertions (parent-shell counted)
[ "$(sh "$HL" docset-cmp 2026-08-13-build.1 2026-08-13-build.2)" = "-1" ] && ok || no "docset build.1<build.2"
[ "$(sh "$HL" docset-cmp 2026-08-13-build.10 2026-08-13-build.2)" = "1" ] && ok || no "docset build.10>build.2"
[ "$(sh "$HL" docset-cmp 2026-08-12-postcall.9 2026-08-13-precall.1)" = "-1" ] && ok || no "docset date desc"
[ "$(sh "$HL" docset-cmp 2026-08-13-build.1 2026-08-13-build.1)" = "0" ] && ok || no "docset equal"

# belief append round-trips and is append-only
TMP="$(mktemp -d)"
LOG="$TMP/log.jsonl"
sh "$HL" belief append "$LOG" --kind trace.open --trace demo --span _meta --note "start" >/dev/null
sh "$HL" belief append "$LOG" --kind belief.open --trace demo --span 1.x --belief "A is best" --confidence 0.6 --risk 0.4 --status OPEN >/dev/null
[ "$(wc -l < "$LOG" | tr -d ' ')" = "2" ] && ok || no "append wrote 2 lines"
grep -q '"risk":0.4' "$LOG" && ok || no "risk field written"

# belief.open without --belief must fail
if sh "$HL" belief append "$LOG" --kind belief.open --trace demo --span 2.y >/dev/null 2>&1; then no "belief.open without belief should fail"; else ok; fi

# validate (needs jq)
if command -v jq >/dev/null 2>&1; then
  sh "$HL" belief validate "$CONF/belief-log/valid/belief-open.jsonl" >/dev/null 2>&1 && ok || no "valid fixture validates"
  if sh "$HL" belief validate "$CONF/belief-log/invalid/bad-kind.jsonl" >/dev/null 2>&1; then no "bad-kind should fail validate"; else ok; fi
  # drift-check exit codes
  sh "$HL" drift-check --manifest "$CONF/manifest/all-in-sync.json" >/dev/null 2>&1 && ok || no "all-in-sync drift ok"
  if sh "$HL" drift-check --manifest "$CONF/manifest/stale-projection.json" >/dev/null 2>&1; then no "stale should exit nonzero"; else ok; fi
fi

rm -rf "$TMP"
printf '\nshell conformance: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
