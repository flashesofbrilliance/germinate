# Changelog

All notable changes to germinate. Format: [Keep a Changelog](https://keepachangelog.com);
this project aims for [SemVer](https://semver.org).

## [0.1.0] — unreleased

Initial scaffold. Four primitives, four conformant implementations, distribution prepared.

### Added
- **Spec + schemas** — normative [`SPEC.md`](SPEC.md); JSON Schemas for belief-log,
  manifest, and handoff front-matter ([`spec/`](spec/)).
- **Conformance suite** — language-neutral fixtures + `cases.json` ([`conformance/`](conformance/))
  that every implementation is tested against (belief-log validation, docset ordering, drift-check).
- **belief-log** — append-only, OTel-shaped JSONL; validate + append with append-only
  ts enforcement; paired `confidence` + `risk` axes.
- **manifest + drift-check** — surface registry (canonical SSOT vs advisory projections);
  mechanical STALE/OUT_OF_SYNC/MISSING verdicts; non-zero exit as a CI gate.
- **handoff** — coal→diamond compaction (`compact`) with head (pickup) + tail (lineage);
  `pickup` cold-start prompt.
- **serializability check** — force-push risk + untracked shared-state detection; `--strict`.
- **init** — prime a tabula-rasa (optionally airgapped, per-tenant) project.
- **Implementations** — Node (reference CLI, npm bin), POSIX shell (zero-dep + git hooks),
  Python (stdlib-only), Rust (zero-dep single binary).
- **Adapters** — Claude Code (skill pair), Cursor, Aider ([`adapters/`](adapters/)).
- **Distribution** — npm package, Homebrew formula, composite GitHub Action, CI, and a
  gated signed-release workflow (npm provenance + cosign keyless). Maintainer holds all secrets.
- **Docs** — [`docs/INTEGRATION.md`](docs/INTEGRATION.md) (pass-through matrix + install tiers),
  [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md), [`docs/adjacencies.md`](docs/adjacencies.md),
  [`docs/RELEASING.md`](docs/RELEASING.md).

### Seed layer (added after an adversarial hardening pass)
- **seed / plant / sprout / seed lint** verbs (Node) + a **seed** as content + germination
  conditions ([`spec/seed.schema.json`](spec/seed.schema.json), SPEC §8).
- **`sprout` is deterministic by design** — literal `soil`/`tags` intersection, a
  *visible* antipattern veto, `STALE` demotion when a `soil` path vanished from git, and
  local-over-global precedence. No NLP/LLM (semantic ripeness = the private ARCS layer).
- **Minimal seed** = content + `soil` + `provenance`; `seed_type` is an open tag;
  unknown fields tolerated (accretion). `preconditions`/`care`/`applications` cut from
  required; `triggers` are annotation-only in v0.1.
- **Tenant-safe**: local `_SEEDS/` default, global opt-in, trace-boundary enforced,
  `seed lint` refuses un-redacted internal identifiers before global publish.
- Conformant in **Node + Python** against shared `seedSprout` fixtures; shell + Rust are
  tracked conformance targets.
- Hardening-driven honesty fixes: "reconciles concurrent workers" → "makes the
  serialized/advisory gap visible"; anti-sycophancy "guarantee" → "self-consistency lint".
- Seven-stage grammar + dormancy semantics ([`docs/grammar.md`](docs/grammar.md)); the
  germinate↔ARCS boundary ([`docs/adjacencies.md`](docs/adjacencies.md)).

### Not yet
- Python/Rust ports of `compact`/`pickup`/`serializability` (spec'd, Node-complete; fixtures pending).
- Roadmap verbs: `drift-check --age` (staleness-distance), hash-chained belief-log, OTLP exporter,
  composable L0→L5 gate pipeline, `init --profile` (policy-as-seed), MCP server. See adjacencies.
