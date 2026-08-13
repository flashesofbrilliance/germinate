# Cursor adapter

Cursor has no session-end hook, so drive the two verbs from **Rules** + a task.

- **Start (a project Rule):** instruct the agent, at the beginning of a task, to run
  `handoff-ledger drift-check --manifest manifest.json` and
  `handoff-ledger pickup SESSION-HANDOFF.md`, then begin at the pickup prompt's
  "START HERE".
- **End (a task or a `.cursor` command):** run
  `handoff-ledger compact --docset <v> --belieflog belieflog.jsonl --manifest manifest.json --starts-at "<next>" --out SESSION-HANDOFF.md`
  and `handoff-ledger serializability --strict`.

Suggested `.cursor/rules/handoff.mdc`:

```md
---
description: Resume and compact sessions with handoff-ledger
alwaysApply: true
---
At task START: run `handoff-ledger pickup SESSION-HANDOFF.md` and `handoff-ledger drift-check`.
Begin at the pickup prompt's START HERE. Verify any live-state claim before acting on it.
At task END: append a belief.update for what changed, then `handoff-ledger compact … --out SESSION-HANDOFF.md`.
Never push/publish without explicit user confirmation.
```

Same contract as every other adapter — see [`../README.md`](../README.md).
