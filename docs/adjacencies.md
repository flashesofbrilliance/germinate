# Adjacencies & roadmap

> Where else the core primitives apply, and what to build next. The core stays
> **domain-blind and dependency-light** — it operates on files + git + provenance,
> never on the semantics of any one field. Everything below is reached via a thin
> **adapter** (same pattern as the harness adapters in [`../adapters/`](../adapters/)),
> not by adding domain logic to the core.
>
> This file is the durable home for design directions surfaced during the initial
> build. Each is a *documented direction*, not a v0.1 commitment.

## Framing candidates

- **"The trace elements of conviction."** The belief-log's real output is not the
  decision but the isotopic signature of how the decision's conviction formed and
  moved — a double meaning on OTel *traces* and geochemical *trace elements* (the
  faint markers that reveal how something formed and where it came from).
- **A bet-ledger, not a diary.** `confidence` and `risk` are the two axes of a bet:
  conviction is licensed to rise *as risk retires*. Confidence climbing while risk
  stays flat is unearned optimism — the "entropy masquerading as motion" the design
  treats as the enemy.

## Domains the belief-log serves as-is (via adapters + example logs)

1. **ML / RL experiment tracking.** `belief.open` = hypothesis; `belief.update`
   {`from`,`to`,`trigger`,`confidence`,`risk`,`evidence`} = "ran experiment N,
   revised understanding, evidence = run-id/checkpoint." A text-native, git-serialized
   cousin of MLflow/W&B run notes — complementary, not a replacement (no tensors/curves).
2. **Computational irreducibility / field journal.** When there's no analytic
   shortcut (cellular automata, chaotic sims, numerical PDE solvers, hyperparameter
   landscapes, a sourdough starter), the only way to know is run → observe → tune,
   and the trace of *how understanding moved and why* is the thing worth keeping.
3. **Model provenance / glass-box tuning.** An auditable lineage of *why* a model
   was tuned this way for a narrow context. Each `belief.update` is a dated,
   evidence-backed tuning decision; the registry checkpoint is a *projection*, and
   `drift-check` flags when it is stale vs. the tuning-decision SSOT.
4. **Forensic / incident trace.** Reconstructing "when did we first believe X was
   compromised, what triggered the update, what evidence." Append-only here is *by
   convention* — see hash-chaining below for forensic-grade tamper-evidence.
5. **Integration-contract drift → API flakiness reduction.** Flakiness is often
   *siloed knowledge*, not bad luck: one branch assumes `POST`, another `GET`; one
   assumes the error path returns `400`, another swallows it — because the contract
   lived in someone's head or an untracked scratch file. Register the integration
   contract as a **canonical surface**; `drift-check` flags the moment a branch's
   projection of it goes stale, catching GET/POST/error-handling divergence *before*
   it ships as intermittent failures. (This is the "off-cloud mock-mirror" pattern:
   a shared field-contract stub so branches can't diverge on the API shape.)

6. **Cross-aesthetics — design taste as durable state.** Taste doesn't survive
   between sessions today: the judgment behind "flat orange fill, radius:0,
   weight:700 — instrument register, not SaaS confetti" evaporates at session end and
   the next session re-litigates it. It carries on the same primitives with no new
   machinery: design *heuristics/patterns* → belief-log (`belief.open` with
   screenshot/reference `evidence`, `confidence` rising as validated across
   artifacts); design *tokens* → a canonical manifest surface (SSOT); *rendered
   artifacts/screenshots* → projections, so `drift-check` catches **aesthetic drift**
   (the artifact that quietly diverged from the tokens). A "good automated artifact
   cadence" is the north-star cadence signal applied to design output. Seventh
   boundary alongside cross-time/-session/-branch/-context/-environment/-agent.

## Capstone: public ledger + private rosetta stone

The belief-log is designed to be **published indelibly** (append-only, hash-chainable,
git-pushed — "the diamond reaching the cloud") *precisely because meaning is separable
from structure*:

- The **public ledger** carries the trace elements — structure, timestamps, `trigger`,
  `confidence`/`risk`, and **opaque `evidence[]` handles** (`ticket-1234`, `gdoc:ID`,
  `ci:run-4123`, a content hash). It proves *that* a belief formed, *when*, and *what
  moved it* — without exposing the substance.
- The **private rosetta stone** — a git-ignored, per-tenant map (e.g. `rosetta.json`,
  or a keyring) — resolves those handles to the actual sensitive content. Holders read
  the full story; everyone else sees a verifiable, tamper-evident skeleton.

This is the mechanism, not a bolt-on: `evidence[]` is *built* to hold opaque references,
not inline content. It unifies **redaction-by-reference** (what makes hash-chaining safe
to publish), the **airgap/client seam** (public *method*, private *priors/rosetta*), and
the Observatory `--attribution hide` / strip-to-subject pattern generalized.

**Guardrail:** never inline secrets into belief text. *Publish the trace; keep the
rosetta private.* A future `belief append` lint (roadmap) should warn on likely-secret
inline content and nudge toward an `evidence[]` handle.

## The germinate ↔ ARCS boundary (why the moat survives open-sourcing)

A seed carries **potential energy** — dormant, viable, waiting for favorable soil. What
converts that potential to kinetic is an **activation spark**. That draws the product
boundary:

- **germinate (open-source, this repo)** = the **seed bank + the generic activation
  contract**. It preserves dormant potential and surfaces mechanically (token/soil
  match, antipattern suppression, dormancy-respecting). It is the substrate and the
  spark's *socket*. Anyone gets this.
- **ARCS (private)** = the **sparkplug / vox animus** — the richer activation
  intelligence that judges *ripeness* beyond token overlap and revives a dormant seed at
  the Kairos moment, using tailored priors and judgment. Not open-sourced.

This is the same seam three times, unified: **public method / private rosetta** ·
**portable discipline / tailored ARCS** · **dormant seed / animating spark**. germinate
ships the socket; ARCS is the current that fires it — which is exactly why germinate is a
clean public good that does not give away the moat.

## Roadmap — future verbs (extend the core, stay dependency-light)

- **`drift-check --age` / staleness-distance.** Every surface carries a dated docset;
  `drift-check` already knows *how many docset versions* a projection has been STALE.
  Surface that as a **drift half-life** — carbon-dating for functional drift and
  technical debt ("this belief last moved 40 docsets / 6 months ago; everything
  downstream inherited it").
- **Hash-chained belief-log.** Each line references the prior line's hash, making the
  append-only guarantee tamper-**evident** rather than convention-only. Turns the log
  forensic-grade and makes any downstream findings tamper-evident too. Opt-in;
  composes with the existing shape.
- **OTLP exporter.** Because the belief-log is already OTel-shaped
  (trace/span/event/status), emit genuine OTLP so it drops into any observability
  backend. Kept out of the v0.1 core to stay dependency-light; ships as an adapter.
- **Composable gate pipeline (L0→L5).** Treat the gate verbs (`drift-check`,
  `serializability`, and roadmap belief-threshold / staleness checks) as **stages**
  in a configurable pipeline that can run **sequential** (fail-fast chain — the CI
  default), **parallel** (independent checks, aggregate verdicts — fast local
  pre-commit), or **entangled** (one stage's verdict modulates another's threshold —
  e.g. a belief's `risk` tightens the drift gate). Each stage is both a **feature
  flag** and an **interoperable function** (a toggle in config *and* a callable in
  the SDK), mapping 1:1 onto the L0–L5 stack. Pure composition over the existing
  functions, so it stays dependency-light; stages *gate*, they never *decide*
  (NOTOMATION-safe). Surfaced as `germinate check --pipeline <config>`.
- **`init` — prime a tabula-rasa project.** Already shipped (Node): scaffolds a
  starter manifest + opened belief-log + config and emits a priming pickup prompt so
  a fresh session (or a net-new Claude project) starts with the discipline in place
  instead of retrofitting it. The durable seed germinates a new project. Also a
  **multi-tenant / airgapped provisioning primitive**: `--trace tenantN` stamps an
  isolated substrate (the `trace` field *is* the tenant boundary; zero-dep +
  local-first + no network = genuinely airgap-deployable; cf. arcs-intel instance
  quarantine).
- **`init --profile` — policy-as-seed.** Grow `init` from plumbing into policy: a
  profile declares what a tenant is *born with* — **security posture** (surface +
  belief with `risk`), **token-budget goals** (config the pipeline/north-star read),
  **RBAC** (pre-registered ownership on canonical surfaces — the `ADMIN_EMAILS`/gate
  pattern, declared not retrofitted), **anticipated minimum-viable artifacts** (MVAs
  pre-registered as `MISSING` surfaces, so `drift-check` becomes a *build checklist*
  the project can't green until its MVAs exist), and **dependencies / runtime
  sources / configs** as canonical surfaces registered at birth. Dependency-light:
  profiles are merged JSON over the starter manifest.
- **North-star metric: squash-rate narrowing.** Measure discard/rework
  (`SUPERSEDED` ratio, belief-update churn per artifact, git squash stats). Its
  *narrowing over time* is a lagging indicator that the atomic compaction loops work.

## Adapters (consumers/producers; core never imports them)

- **Escalation / routing rules (near-realtime).** A thin rules layer over the belief
  event stream: "when a `belief.update` pushes `risk` above threshold or flips
  `status` to a watch state, route to owner X per the table." Same routing-table
  pattern as any lead/incident router, keyed on belief events. Pairs with the OTLP
  exporter (emit) and the security adapter (consume).
- **Governance kill-switch / circuit-breaker.** The gate verbs already exit non-zero
  to trip CI (`drift-check --strict`, `serializability --strict`), and the pre-push
  hook is a literal breaker at the push boundary. Named trip-signals on belief
  thresholds drop on top. Critical property: it **halts, it does not decide** — it
  scaffolds the human gate, never overrules it. It also reads as a **stop-loss**:
  "you're about to enter a rabbit hole — stage a sanity check here, here, here"
  (N belief-updates with no status change and no new artifact = looping, not
  progressing — the Drift Sentinel, made computable).
- **Security review (CISO / red-blue-team).** A subagent that reads the belief-log +
  manifest as its evidence substrate and emits threat-vector findings; `evidence[]`
  and `risk` are what it triages on. Hash-chaining makes its findings tamper-evident.
- **Hosted microservice (infra-agnostic).** Wrap the same core functions behind
  whatever handler the platform speaks — AWS Lambda, a Vercel Fluid Compute route
  (Node.js, **not** Edge), a Cloudflare Worker, a LangChain `Tool`, a plain
  Flask/FastAPI route, a container. The core never imports the platform; the adapter
  is a thin shell around it. Drift-check-as-a-service, belief-log ingest, escalation
  webhook.

## Designated public-good #2 — `kairos`

The circuit-breaker answers *"when must the human stop the machine?"*. **Kairos**
answers the higher-value question *"when is the opportune moment to bring the human
in?"* — **conditional cron, not cron-driven**: evaluation fires on *conditions*
(a belief-log crossing a risk/confidence divergence, a drift half-life exceeded, a
staleness-distance threshold), never on wall-clock. It is the natural consumer of
everything germinate produces: this repo lays the durable, condition-bearing
substrate; `kairos` watches it and fires "now." A separate repo, a separate clean
public good, sequenced immediately after this one — and, like the others, a killer
infra-agnostic microservice built on the wrap-the-core pattern.

## Designated public-good #3 (candidate) — `observatory`

A replay theater / visualizer over belief-logs (and their OTLP projection): scrub the
timeline, watch conviction gradients form and collapse, overlay sessions, annotate
inflection points. `germinate` produces the durable trace; `observatory` renders
it. Separable, and a public good in its own right.
