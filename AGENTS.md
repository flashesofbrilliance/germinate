<!-- intent:begin -->
## Intent
- **Why:** An open, implementation-neutral handoff protocol: compact an ephemeral agent session into a durable seed (manifest + belief-log + handoff) that other sessions, agents, branches, and environments can pick up and merge through git. Node, Python, Rust, and POSIX shell implementations conform to one shared suite.
- **Done looks like:** SPEC.md leaves DRAFT; every runtime passes `conformance/`; each release tag is on its registry; arcs-v9's `_SEEDS/` keeps citing it as the open contract.
- **Not this:** Not ARCS-specific product code; the implementations are conformance targets, not the definition. Do not change behavior in one runtime without changing SPEC.md, `spec/` schemas, and fixtures together.
- **Status:** live (published on npm as `germinate` 0.1.0, maintainer zachharris; repo `packages/*/package.json` says 0.1.1, which is not on the registry)
- **Last verified:** 2026-10-03 (`npm view germinate version repository.url maintainers`; `git log`: last merge `4e0b4a5` on 2026-09-29)
- **Spec:** SPEC.md (normative: RFC 2119 contract v0.1.0 DRAFT, with `spec/` JSON Schemas and `conformance/` fixtures)
<!-- intent:end -->
