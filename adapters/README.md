# Adapters

A **harness adapter** is a thin mapping from a specific agent environment onto the
handoff-ledger core. It answers two questions for that harness:

1. **Where does it keep session/scratch state?** (so `compact` can find it)
2. **How do we invoke `compact` at session end and `pickup` at session start?**

Adapters are **optional** and **never imported by the core**. Each is a few lines of
glue over the same two verbs (`compact`, `pickup`) plus the gate verbs
(`drift-check`, `serializability`). If your harness can run a shell command at
session boundaries, it can use handoff-ledger.

| Harness | Session-end hook → | Session-start hook → | Directory |
|---|---|---|---|
| **Claude Code** | `/handoff` slash command → `compact` | `/handoff-pickup` → `pickup` | [`claude-code/`](claude-code/) |
| **Cursor** | a task/rule that runs `compact` | a rule that runs `pickup` | [`cursor/`](cursor/) |
| **Aider** | a `--commit`-time script hook | a shell alias that runs `pickup` | [`aider/`](aider/) |
| **Generic / CI** | `handoff-ledger compact` in a step | `handoff-ledger pickup` in a step | (use the CLI directly) |

## The contract every adapter follows

```
# session start
handoff-ledger pickup SESSION-HANDOFF.md          # -> a cold-start prompt for the agent
handoff-ledger drift-check --manifest manifest.json   # fail fast if surfaces disagree

# during the session
handoff-ledger belief append belieflog.jsonl --kind belief.update --span … \
    --from … --to … --trigger … --confidence … --risk … --status …

# session end
handoff-ledger compact --docset <v> --belieflog belieflog.jsonl \
    --manifest manifest.json --starts-at "<next pickup>" --out SESSION-HANDOFF.md
handoff-ledger serializability --strict           # guard the serialized surface before push
```

A hosted **microservice** adapter is the same contract behind an HTTP handler
(infra-agnostic: Lambda, a serverless route, a worker, a LangChain tool). The core
never imports the platform.
