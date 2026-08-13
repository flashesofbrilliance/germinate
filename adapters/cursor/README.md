# Cursor adapter

Cursor has no session-end hook, so drive the two verbs from **Rules** + a task.

- **Start (a project Rule):** instruct the agent, at the beginning of a task, to run
  `germinate drift-check --manifest manifest.json` and
  `germinate pickup SESSION-HANDOFF.md`, then begin at the pickup prompt's
  "START HERE".
- **End (a task or a `.cursor` command):** run
  `germinate compact --docset <v> --belieflog belieflog.jsonl --manifest manifest.json --starts-at "<next>" --out SESSION-HANDOFF.md`
  and `germinate serializability --strict`.

Suggested `.cursor/rules/handoff.mdc`:

```md
---
description: Resume and compact sessions with germinate
alwaysApply: true
---
At task START: run `germinate pickup SESSION-HANDOFF.md` and `germinate drift-check`.
Begin at the pickup prompt's START HERE. Verify any live-state claim before acting on it.
At task END: append a belief.update for what changed, then `germinate compact … --out SESSION-HANDOFF.md`.
Never push/publish without explicit user confirmation.
```

Same contract as every other adapter — see [`../README.md`](../README.md).
