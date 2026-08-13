---
description: Compact this session into a durable handoff-ledger seed (coal→diamond)
---

Compact the current session using the `handoff-ledger` CLI. Steps:

1. Determine the docset version for this session (format `YYYY-MM-DD-<phase>.<n>`).
   If a `.handoff-ledger.json` exists, read defaults from it.
2. If understanding changed this session, append a closing belief event:
   ```
   handoff-ledger belief append belieflog.jsonl --kind belief.update \
     --trace <project> --span <thread> --from "<prior>" --to "<now>" \
     --trigger "<what changed>" --confidence <0..1> --risk <0..1> --status <OPEN|ALIGNED|…>
   ```
3. Assemble the seed and write it:
   ```
   handoff-ledger compact --docset <v> --belieflog belieflog.jsonl \
     --manifest manifest.json --starts-at "<where the next session starts>" \
     --blocking "<blockers or NONE>" --out SESSION-HANDOFF.md
   ```
4. Guard the serialized surface before any push:
   ```
   handoff-ledger serializability --strict
   ```
5. Report the written `SESSION-HANDOFF.md` path and any serializability warnings to
   the user. Do NOT push or publish anything without explicit confirmation.
