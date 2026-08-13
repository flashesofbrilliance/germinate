# germinate — Specification v0.1.0

> Normative spec for a serializable, provenance-carrying handoff protocol for
> multi-agent / multi-worktree development. Status: **DRAFT**. This document uses
> RFC 2119 keywords (MUST / SHOULD / MAY).

This spec is **implementation-neutral**. The Node, Python, Rust, and shell
implementations in this repository are conformance targets, not the definition.
The definition is: this document, the JSON Schemas in [`spec/`](spec/), and the
fixtures in [`conformance/`](conformance/).

---

## 0. The model

An agentic development session is **high-entropy and ephemeral**: a conversation,
scratch files, several open worktrees, half-formed understanding. Two problems
recur, on two orthogonal axes.

### Axis 1 — Temporal (coal → diamond)

A single session must be compacted into a **dense, durable seed** that a later
session (or a different agent, or a human) can pick up cold. The seed has three
parts:

- a **manifest** — what surfaces exist and whether they agree;
- a **belief-log** — the append-only history of *understanding* (not of files);
- a **handoff** — the compaction itself, with a **head** (forward pickup
  pointers: "next session starts here") and a **tail** (provenance/lineage: how
  we got here, what was decided, what is still open).

"The diamond reaching the cloud" is `git push`: the durable seed becomes shared,
serialized state.

### Axis 2 — Concurrent (global serializability)

Many local workers (worktrees, agents, machines) write concurrently and must
reconcile to **one agreed total order without lost updates**.

**Git is the serializer.** Its non-fast-forward rejection *is* the write-lock:
you cannot overwrite an order you have not observed. But this guarantee holds
**only for tracked files**. Out-of-band surfaces — cloud docs, hosted artifacts,
snapshot files, dashboards — have no such lock; a concurrent editor silently
clobbers them. That gap between *serialized* (git-tracked) and *advisory*
(everything else) is the central hazard this toolkit makes **visible and
enforceable**.

---

## 1. Surfaces, canonical sources, and projections

A **surface** is any place a fact lives: a git-tracked file, a cloud document, a
hosted artifact, a snapshot.

- A **canonical source** (`kind: "canonical"`) is git-tracked and diffable. It is
  the single source of truth (SSOT) for the facts it carries.
- A **projection** (`kind: "projection"`) is a rendering of one or more canonical
  sources onto an out-of-band surface (a Google Doc, a published artifact). A
  projection is **advisory**: git does not lock it, so it can silently go stale.

Every surface carries a **docset version** (§4). A projection whose stamped
version is **less than** the manifest's header version is **STALE by definition** —
no content comparison required. This is the cheap, mechanical drift signal.

---

## 2. The belief-log

An **append-only**, OpenTelemetry-shaped JSONL file. One JSON object per line.
It version-tracks **understanding**, not files: each line is a belief event.

### 2.1 Data model (OTel mapping)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `ts` | string (RFC 3339) | yes | event timestamp |
| `trace` | string | yes | the engagement/topic (one OTel *trace*) |
| `span` | string | yes | one belief's lifetime (one OTel *span*); `_meta` reserved for the trace-open line |
| `kind` | enum | yes | `trace.open` · `belief.open` · `belief.update` · `belief.close` · `note` |
| `phase` | string | no | free-form lifecycle bucket (e.g. `pre_call`, `build`, `post_call`) |
| `belief` | string | on `belief.open` | the claim, as currently understood |
| `from` / `to` | string | on `belief.update` | prior → revised understanding |
| `trigger` | string | no | what caused the update (event, evidence, decision) |
| `confidence` | number 0..1 | no | subjective confidence in the belief |
| `evidence` | string[] | no | provenance handles (file paths, URLs, ticket/case IDs) |
| `status` | enum | no | `OPEN` · `ALIGNED` · `SUPERSEDED` · `DEFERRED` · `CLOSED` |
| `note` | string | no | free text (required on `kind: "note"` and `trace.open`) |

### 2.2 Rules (normative)

1. Lines MUST be append-only. An implementation MUST NOT edit or delete a prior
   line. Corrections are new lines (`belief.update` or `belief.close`).
2. Each line MUST be valid JSON on a single line (`\n`-terminated). The file is
   JSONL, not a JSON array.
3. `ts` MUST be RFC 3339. Appenders SHOULD use timezone-aware timestamps.
4. The first line of a log SHOULD be `kind: "trace.open"` with `span: "_meta"`
   documenting the trace's conventions.
5. `confidence`, when present, MUST be in `[0, 1]`.
6. A `belief.update` SHOULD carry `from` and `to`; a validator MAY warn if either
   is absent.
7. `span` values group a belief's lifetime: an `open`, zero or more `update`s, and
   an optional `close`, all sharing one `span` string within one `trace`.

An appender MUST reject a write that would break append-only ordering (e.g. a `ts`
earlier than the last line's) unless `--allow-clock-skew` is set, in which case it
MUST emit a warning.

---

## 3. The manifest

A registry of every surface plus a mechanical sync procedure. The canonical
serialization is a JSON sidecar (`manifest.json`, validated by
[`spec/manifest.schema.json`](spec/manifest.schema.json)); a human-readable
Markdown projection MAY be rendered from it.

```jsonc
{
  "docsetVersion": "2026-08-13-build.1",   // the header version (§4)
  "canonicalBranch": "main",
  "surfaces": [
    { "id": "S1", "kind": "canonical", "path": "docs/DOSSIER.md",
      "role": "master SSOT", "docset": "2026-08-13-build.1" },
    { "id": "G1", "kind": "projection", "ref": "gdoc:1fjGq…",
      "source": ["S1"], "docset": "2026-08-13-build.1", "status": "IN_SYNC" }
  ]
}
```

- `id` MUST be unique within the manifest.
- A `canonical` surface MUST have a `path` (git-tracked).
- A `projection` MUST have a `ref` (an opaque out-of-band handle) and SHOULD have
  a `source` array of canonical `id`s it is rendered from.
- Every surface MUST carry a `docset` string.

### 3.1 `drift-check` (normative algorithm)

For each surface `s` in the manifest:

1. If `version(s.docset) < version(manifest.docsetVersion)` → **STALE**.
2. Else if `s.kind == "projection"` and `s.status != "IN_SYNC"` → **OUT_OF_SYNC**.
3. Else if `s.kind == "canonical"` and `s.path` does not exist in the working
   tree → **MISSING**.
4. Else → **IN_SYNC**.

`drift-check` MUST exit non-zero if any surface is STALE, OUT_OF_SYNC, or MISSING,
and exit zero only when every surface is IN_SYNC. This makes it a CI gate.

---

## 4. Docset versioning

Format: `YYYY-MM-DD-<phase>.<n>` — date + a free-form phase label + a monotonic
increment. Comparison is: date descending, then phase (lexical), then `<n>`
numeric. Bump `.n` for any content change; roll the date/phase at a real state
change (a decision, a call, a build milestone). Every rendered surface SHOULD
carry `docset: <version>` in its header so drift is visible on open.

An implementation MUST provide a total order over docset versions consistent with
the fixtures in [`conformance/`](conformance/).

---

## 5. The handoff

The coal→diamond compaction. Serialized as Markdown with YAML front-matter
(validated by [`spec/handoff.schema.json`](spec/handoff.schema.json) against the
front-matter object).

```markdown
---
handoffVersion: "0.1.0"
title: "…"
docset: "2026-08-13-build.1"
head:                       # forward pickup pointers — where the NEXT session starts
  startsAt: "…"
  openThreads: ["…"]
  blocking: "NONE"
tail:                       # provenance / lineage — how we got here
  lastCommit: "abc1234"
  belieflog: "path/to/belieflog.jsonl"
  manifest: "path/to/manifest.json"
  supersedes: "…"
---

## What changed
## State (what's live / done)
## Open / next
## Provenance
```

- `head.startsAt` MUST be present — a handoff with no pickup pointer is not a
  handoff.
- `tail` SHOULD reference the belief-log and manifest that back the claims.
- A handoff compaction helper MUST be able to *assemble* the seed (manifest +
  belief-log tail + open threads) and *emit a pickup prompt* — a short,
  self-contained cold-start message for the next agent.

---

## 6. Serializability check

Given a repository and a manifest, the check MUST report:

1. **Force-push risk** — the current branch is behind its upstream (a push would
   require `--force` and would drop commits). This is a lost-update hazard on the
   *serialized* surface.
2. **Untracked shared state** — any manifest surface whose `path` is not tracked
   by git (untracked or gitignored), or any projection with no `source`. These
   are *advisory* surfaces masquerading as durable; git will not protect them.

The check is advisory by default (exit 0 with warnings) and MUST support a
`--strict` mode (non-zero exit) for CI and pre-push hooks.

---

## 7. Harness-agnostic adapters

The core operates on files and git only. A **harness adapter** is a thin mapping
from a specific agent environment (Claude Code, Cursor, Aider, …) to the core:
where that harness keeps scratch/session state, and how to invoke `compact` at
session end and `pickup` at session start. Adapters MUST NOT be required by the
core and MUST live under [`adapters/`](adapters/). See that directory's README.

---

## 8. Conformance

An implementation is **conformant** if it passes every fixture in
[`conformance/`](conformance/). Fixtures are language-neutral: input files plus
`cases.json` declaring the expected outcome (valid/invalid, drift verdict, docset
ordering). New behavior MUST land as a fixture before an implementation claims it.
