# handoff-ledger

> A serializable, provenance-carrying **handoff protocol** for multi-agent /
> multi-worktree development. Compact one high-entropy session into a dense,
> durable seed; reconcile many concurrent workers into one agreed order without
> lost updates; and make the gap between *serialized* and *advisory* state
> **visible and enforceable**.

**License:** MIT · **Status:** v0.1.0 (draft) · **Runtimes:** Node · Python · Rust · POSIX shell
— all four verified against one shared [conformance suite](conformance/).

*The belief-log's real output is not the decision — it's the trace elements of
conviction: the faint markers of how a decision's conviction formed and moved.*

**In one line:** durable, mergeable state across every boundary an agentic
workflow crosses — cross-**time**, cross-**session**, cross-**branch/worktree**,
cross-**context**, cross-**environment**, cross-**agent**. Git already solves *order*
for tracked files; the belief-log solves it for *understanding*; the manifest solves
it for the surfaces git can't lock.

---

## The problem

An agentic dev session is **high-entropy and ephemeral**: a conversation, scratch
files, several open worktrees, half-formed understanding. Almost none of it
survives to the next session — and what's *most* portable is never the per-task
deliverable, but the **machinery that makes ephemeral sessions durable and
mergeable**. Two orthogonal axes:

### Temporal — coal → diamond

Compact a session into a dense, durable **seed** a later session (or a different
agent, or a human) can pick up cold. Three parts:

- **manifest** — what surfaces exist and whether they agree;
- **belief-log** — the append-only history of *understanding* (not of files);
- **handoff** — the compaction, with a **head** (forward pickup pointers: "next
  session starts here") and a **tail** (provenance/lineage: how we got here).

"The diamond reaching the cloud" is `git push`.

### Concurrent — global serializability

Many workers write at once and must reconcile to **one agreed total order without
lost updates**. **Git is the serializer** — its non-fast-forward rejection *is* the
write-lock. But that guarantee holds **only for tracked files**. Cloud docs, hosted
artifacts, snapshots, dashboards have no such lock; a concurrent editor silently
clobbers them. That gap — *serialized* (git-tracked) vs. *advisory* (everything
else) — is the central hazard this toolkit surfaces.

---

## The four primitives

| Primitive | What it is | Command |
|---|---|---|
| **belief-log** | append-only, OpenTelemetry-shaped JSONL that version-tracks *understanding* (trace/span/kind/confidence/risk/evidence/status) | `belief validate` · `belief append` |
| **manifest** | registry of every surface (canonical git SSOT + advisory projections), each stamped with a docset version | `drift-check` |
| **handoff** | coal→diamond compaction: head (pickup) + tail (lineage) | `compact` · `pickup` |
| **serializability check** | git is the serializer for tracked files; warn where advisory state escapes the lock | `serializability` · `install-hooks` |

A projection whose stamped docset is **less than** the manifest header is **STALE
by definition** — no content diff required. `drift-check` exits non-zero on any
drift, so it is a CI gate. See [`SPEC.md`](SPEC.md) for the normative model.

---

## Install

```bash
# npm (Node CLI — bins: handoff-ledger, hl)
npm install -g handoff-ledger

# Homebrew (signed single binary — the Rust build)
brew install flashesofbrilliance/tap/handoff-ledger

# or vendor the zero-dep shell CLI directly
cp packages/shell/hl.sh /usr/local/bin/hl && chmod +x /usr/local/bin/hl
```

> Nothing is hosted. There is **no server, no Vercel config, no database** — it's a
> CLI + file-format + library. The least-invasive, highest-leverage install is a
> local git hook; the team gate is a GitHub Action. See [`docs/INTEGRATION.md`](docs/INTEGRATION.md).

---

## Quickstart

```bash
# 1. Record understanding as it forms (append-only, OTel-shaped)
hl belief append notes.jsonl --kind trace.open --trace myproj --span _meta --note "belief log"
hl belief append notes.jsonl --kind belief.open --trace myproj --span 1.path \
   --belief "Path A is fastest" --confidence 0.6 --risk 0.4 --status OPEN
hl belief append notes.jsonl --kind belief.update --trace myproj --span 1.path \
   --from "Path A is fastest" --to "Path B, given the new constraint" \
   --trigger "benchmark" --confidence 0.85 --risk 0.15 --status ALIGNED

# 2. Track every surface + catch drift (CI gate)
hl drift-check --manifest manifest.json          # exit 1 if any projection is STALE

# 3. Compact the session into a durable seed + a cold-start pickup prompt
hl compact --docset 2026-08-13-build.1 --belieflog notes.jsonl \
   --starts-at "wire delivery to the sandbox" --out SESSION-HANDOFF.md
hl compact --belieflog notes.jsonl --starts-at "…" --prompt   # emit pickup prompt

# 4. Guard the serialized surface (force-push risk / untracked shared state)
hl serializability --strict
hl install-hooks                                  # installs a pre-push breaker
```

Full worked example: [`examples/quickstart/`](examples/quickstart/).

---

## Why polyglot, and how it stays honest

The **real deliverable is language-neutral**: the [`SPEC.md`](SPEC.md), the JSON
Schemas in [`spec/`](spec/), and the [`conformance/`](conformance/) fixtures. Every
implementation — Node, Python, Rust, shell — is tested against the *same* fixtures,
so they cannot silently diverge. That is the toolkit's own anti-drift principle,
applied to its own codebase.

| Runtime | Role | Path |
|---|---|---|
| **Node/TS** | reference CLI, npm bin, provenance signing | [`packages/node`](packages/node) |
| **POSIX shell** | zero-dep CLI + git hooks (home of the serializability checks) | [`packages/shell`](packages/shell) |
| **Python** | stdlib-only port | [`packages/python`](packages/python) |
| **Rust** | signed single binary for the Homebrew bottle | [`packages/rust`](packages/rust) |

---

## Harness-agnostic

The core operates on files + git only. A **harness adapter** maps a specific agent
environment (Claude Code, Cursor, Aider, …) onto `compact` at session end and
`pickup` at session start. Adapters are thin and optional — see
[`adapters/`](adapters/). The same wrap-the-core pattern hosts an infra-agnostic
microservice (Lambda / serverless / worker / LangChain tool) when you want one.

Where else these primitives apply (ML/RL experiment tracking, model provenance,
forensic traces, governance circuit-breakers, and the designated follow-on public
goods `kairos` and `observatory`): [`docs/adjacencies.md`](docs/adjacencies.md).

---

## Distribution & signing

npm (provenance/sigstore), a Homebrew tap, and a GitHub Actions release workflow
are scaffolded in [`docs/RELEASING.md`](docs/RELEASING.md) and
[`.github/workflows/`](.github/workflows/). **The maintainer performs the actual
signed publish and holds all secrets** — this repo prepares the workflow, never the
keys.

## Design principles

Six principles govern every stage (plan → build → accept), each bound to a concrete
mechanism: **traceable · transparent · explainable · composable · anti-hallucination
· anti-sycophancy**. See [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md).

## Contributing

New behavior lands as a **conformance fixture first**, then in each implementation.
Run `make test` (or per-package: `npm test`, `python -m unittest`, `cargo test`,
`sh packages/shell/test.sh`).
