# Claude Code adapter

Two slash commands wrap the two verbs. Copy `handoff.md` and `handoff-pickup.md`
into `~/.claude/commands/` (global) or `.claude/commands/` (per-repo), and make sure
`handoff-ledger` (or `hl`) is on `PATH`.

- **`/handoff`** — at session end: append a closing belief, assemble the
  coal→diamond seed, run the serializability guard, and write `SESSION-HANDOFF.md`.
- **`/handoff-pickup`** — at session start: run `drift-check`, then emit the
  cold-start pickup prompt so the agent resumes with full context.

Both are thin — they shell out to the CLI and let the core do the work. Nothing here
is handoff-ledger-specific to Claude Code beyond the command wrappers; the same two
verbs power the Cursor and Aider adapters.

> Note: these are generic, clean-room command templates. They are **not** the same
> as any project-specific `/handoff` command you may already have — point them at
> your repo's `manifest.json` / `belieflog.jsonl` paths (or a `.handoff-ledger.json`).
