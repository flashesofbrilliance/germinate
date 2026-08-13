---
description: Compact this session into a durable germinate seed (coal→diamond)
---

Compact the current session using the `germinate` CLI. Steps:

1. Determine the docset version for this session (format `YYYY-MM-DD-<phase>.<n>`).
   If a `.germinate.json` exists, read defaults from it.
2. If understanding changed this session, append a closing belief event:
   ```
   germinate belief append belieflog.jsonl --kind belief.update \
     --trace <project> --span <thread> --from "<prior>" --to "<now>" \
     --trigger "<what changed>" --confidence <0..1> --risk <0..1> --status <OPEN|ALIGNED|…>
   ```
3. Assemble the seed and write it:
   ```
   germinate compact --docset <v> --belieflog belieflog.jsonl \
     --manifest manifest.json --starts-at "<where the next session starts>" \
     --blocking "<blockers or NONE>" --out SESSION-HANDOFF.md
   ```
4. Guard the serialized surface before any push:
   ```
   germinate serializability --strict
   ```
5. Report the written `SESSION-HANDOFF.md` path and any serializability warnings to
   the user. Do NOT push or publish anything without explicit confirmation.
