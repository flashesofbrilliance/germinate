# Changelog

All notable changes to handoff-ledger. Format: [Keep a Changelog](https://keepachangelog.com);
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

### Not yet
- Python/Rust ports of `compact`/`pickup`/`serializability` (spec'd, Node-complete; fixtures pending).
- Roadmap verbs: `drift-check --age` (staleness-distance), hash-chained belief-log, OTLP exporter,
  composable L0→L5 gate pipeline, `init --profile` (policy-as-seed), MCP server. See adjacencies.
