# Guiding architectural principles

These six principles govern every stage — **planning → build → acceptance testing**.
They are not aspirations bolted on after the fact; each is bound to a concrete
mechanism already in the toolkit (or a named roadmap item). A change that violates a
principle is a design bug, not a style preference.

| Principle | Mechanism that enforces it | Plan | Build | Accept |
|---|---|---|---|---|
| **Traceable** | belief-log is OTel-shaped (trace/span/event); git is the lineage; docset dates every surface; hash-chain (roadmap) makes it tamper-evident | every plan opens a `trace` + spans | each decision is a `belief.*` line with `ts` | the trace *is* the audit trail |
| **Transparent** | append-only plain-text JSONL + Markdown; no hidden/binary state; `--json` on every verb; the manifest lists *every* surface, advisory ones included | surfaces declared up front | nothing edited in place, nothing hidden | reviewer reads the raw log, not a summary |
| **Explainable** | belief-log carries `from`/`to`/`trigger`/`evidence` — the *why*, not just the *what*; `pickup` renders a self-contained rationale | plan records the reasoning, not the verdict | updates state what changed and why | acceptance shows the causal chain to any decision |
| **Composable** | four orthogonal primitives; library-*is*-the-SDK (identical fns across 4 runtimes); adapters + wrap-the-core; the L0→L5 gate pipeline (roadmap) | stages picked from a menu | verbs pipe on stable `--json` | gates compose seq/parallel/entangled |
| **Anti-hallucination** | `drift-check` is *mechanical* ("STALE by definition", no judgment); `evidence[]` demands provenance; `pickup` says *verify live-state before acting*; conformance fixtures gate every claimed capability | plan can't assert un-sourced facts | a capability isn't "done" until its fixture passes | acceptance re-verifies, never trusts the seed |
| **Anti-sycophancy** | `confidence`**+**`risk` as paired axes (conviction must be *earned* as risk retires; rising confidence + flat risk = flagged); the Drift Sentinel (looping ≠ progress); gates **halt, never decide** (NOTOMATION) | plan states residual risk, not just upside | belief-updates can move confidence *down* | acceptance rejects unearned green |

## How they show up in the lifecycle

- **Planning.** A plan is a `trace` opened in the belief-log plus surfaces declared in
  the manifest. It records *reasoning and residual risk*, not a verdict. Nothing is
  asserted without `evidence[]`.
- **Build.** Every decision is an append-only `belief.*` line; corrections are new
  lines (`belief.update`), never edits. New behavior lands as a **conformance fixture
  first** — a capability cannot be claimed until its fixture passes in every runtime.
  `drift-check` and `serializability` gate the work mechanically.
- **Acceptance.** The reviewer reads the raw belief-log and runs `drift-check` — they
  do not trust a hand-written summary. Green requires *earned* conviction: fixtures
  pass, surfaces are IN_SYNC, and no belief shows rising confidence against flat risk.
  Gates **halt**; the human **decides**.

## The one-line test

For any proposed feature or change, ask: *does it make the system more traceable,
transparent, explainable, and composable — while reducing the chance of a confident
falsehood or an unearned yes?* If it trades any of these for convenience, redesign it.
