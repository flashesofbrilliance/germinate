# The germinate grammar — a seed's lifecycle

germinate uses a **botanical lifecycle grammar** for its verbs, the way Homebrew uses
a brewing metaphor (`tap`, `pour`, `bottle`). The metaphor is not decoration — it
carries real semantics, especially around **dormancy**.

## Why a seed (not a "record")

A seed is engineered to **survive the harshest conditions** and **carry genetic
legacy forward until conditions are favorable again**. That is precisely the agentic
problem: a hard-won insight must survive session death, context loss, and dormant
projects, then re-express — with fidelity — the moment its soil returns. A seed is
*content (the genetic code) + germination conditions*, not just stored content.

**Consequence — dormancy is a first-class state, not staleness.** A seed that has not
matched in months is not drift and not dead; it is **dormant**: viable, waiting for
its triggers/soil to recur. Therefore:

- germinate **never garbage-collects a dormant seed.** Dormancy under adverse
  conditions *is the feature* (throwaway context, not throwaway learning).
- `care` describes viability signals, not an expiry clock. `water` refreshes a seed;
  it does not resurrect a dead one, because dormant seeds were never dead.
- **Zero ripe seeds is a healthy state** ("winter"), never an error. The surfacer must
  return an empty set calmly.

## The seven stages

| Verb | Stage | What it does | Status |
|---|---|---|---|
| `seed` | **mint** | compact content + germination conditions into a seed (from a session / handoff) | v0.1 |
| `plant` | **deposit** | place the seed in a bank; `soil` decides global (`~/.claude/.../seeds/`) vs local (`<repo>/_SEEDS/`) | v0.1 |
| `water` | **maintain** | refresh `care` / keep a dormant seed viable; update triggers as understanding evolves | v0.1 (light) |
| `germinate` | **activate** | evaluate current conditions against every seed's germination block (the namesake engine) | v0.1 |
| `sprout` | **surface** | emit the seeds whose conditions are favorable *now* into the current session (the activation output) | v0.1 |
| `grow` | **apply** | develop a sprouted seed in the working context | v0.2 |
| `harvest` | **reap** | mint new seeds from matured output → back to `seed` (closes the loop) | v0.2 |

`harvest → seed` is the cycle: today's applied insight becomes tomorrow's dormant
seed. The loop is what makes the bank compound instead of merely accumulate.

## The activation contract (germinate / sprout)

Given the current context (tokens from `--context`, `--trace`, and cwd):

1. For each seed, a **soil** or **tags** entry *matches* when all its tokens are a subset
   of the context tokens (case-insensitive). `score` = count of matching soil+tags.
   (`triggers` are v0.1 **annotation only**, reserved for the semantic/ARCS layer;
   `preconditions` were cut in v0.1 — see the hardening notes.)
2. Classification, in precedence order: any `antipattern` match → **SUPPRESSED** (the
   vetoing antipattern is shown); else `score > 0` with a vanished soil path → **STALE**
   (demoted, never surfaced confident); else `score > 0` → **SURFACED**; else
   → **DORMANT**.
3. SURFACED sorts by `score` (desc), then `id` (asc) for determinism.
4. Dormant (unmatched) seeds are **retained untouched** — no GC, no penalty. An empty
   result is a healthy "winter", never an error.

This is **deterministic** (no NLP/embeddings/LLM) so the conformance suite can pin it and
`sprout` cannot hallucinate a match. Semantic ripeness is the private ARCS layer, not
this socket. The contract is fixtured, so `sprout` behaves identically across runtimes.
