#!/usr/bin/env sh
# End-to-end walkthrough of the four primitives. Runnable; writes into a temp dir.
# Usage: sh examples/quickstart/run.sh   (uses the Node CLI from this repo)
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HL="node $ROOT/packages/node/bin/germinate.js"
WORK="$(mktemp -d)"
cd "$WORK"

echo "== 1. init — prime a fresh (airgapped) project =="
$HL init --trace quickstart | head -3

echo "\n== 2. belief-log — record understanding as it forms (with confidence + risk) =="
$HL belief append belieflog.jsonl --kind belief.open --trace quickstart --span 1.approach \
  --belief "Ship the CLI before the hosted service" --confidence 0.6 --risk 0.4 --status OPEN
$HL belief append belieflog.jsonl --kind belief.update --trace quickstart --span 1.approach \
  --from "Ship the CLI before the hosted service" \
  --to "CLI + git hook is the whole MVP; service is optional" \
  --trigger "user requirement: least-invasive install" --confidence 0.9 --risk 0.1 --status ALIGNED

echo "\n== 3. register a projection + run drift-check =="
cat > manifest.json <<JSON
{
  "docsetVersion": "2026-08-13-build.2",
  "canonicalBranch": "main",
  "surfaces": [
    { "id": "S1", "kind": "canonical", "path": "belieflog.jsonl", "role": "belief SSOT", "docset": "2026-08-13-build.2" },
    { "id": "D1", "kind": "projection", "ref": "gdoc:EXAMPLE", "source": ["S1"], "docset": "2026-08-13-build.1", "status": "IN_SYNC" }
  ]
}
JSON
echo "(D1 is stamped build.1 but the docset is build.2 — expect STALE)"
$HL drift-check --manifest manifest.json || echo "  -> drift-check exited non-zero (CI would fail here). Fix: re-render D1 and bump its docset."

echo "\n== 4. compact into a durable seed + emit a pickup prompt =="
$HL compact --docset 2026-08-13-build.2 --belieflog belieflog.jsonl --manifest manifest.json \
  --starts-at "re-render D1 to build.2, then wire the release workflow" --out SESSION-HANDOFF.md >/dev/null
echo "--- SESSION-HANDOFF.md (head) ---"; sed -n '1,18p' SESSION-HANDOFF.md
echo "\n--- pickup prompt ---"; $HL pickup SESSION-HANDOFF.md

echo "\nworkdir: $WORK"
