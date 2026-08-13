# Integration guide — pass-throughs, install tiers, and the SDK surface

This is the single source of truth for **every way to reach germinate**. The
design goal: one stable contract, exposed four ways (CLI, library, JSON, optional
MCP), documented in one table so the surface can't rot.

---

## 1. The core is not a service

germinate is a **CLI + file-format + library**. There is deliberately **no
hosted service, no Vercel config, no Supabase script** in the core — adding a server
would be the *most* invasive option, not the least. The value is local-first and
git-native. A hosted microservice is an *optional adapter* (§4), infra-agnostic,
that wraps the same functions.

---

## 2. Install tiers — least invasive, highest leverage first

| Tier | Command | Lives in | Benefit | Invasiveness |
|---|---|---|---|---|
| **1. Local hook** | `germinate install-hooks` | `.git/hooks/pre-push` | serializability guard fires at the one moment it matters | **lowest** — one command, nothing hosted |
| **2. Team CI gate** | add the composite action | `.github/workflows/*.yml` | `drift-check --strict` on every PR — drift becomes a *team* gate | low — a few lines of YAML |
| **3. Agent adapter** | a `/handoff` skill/plugin | your harness config | `compact` at session end, `pickup` at start | low — thin wrapper over the CLI |
| **4. Hosted microservice** | wrap core fns in a handler | Lambda / Fluid Compute / worker | drift-check-as-a-service, ingest, webhooks | opt-in — only if you need it |

**Recommended minimal footprint:** Tier 1 (personal) + Tier 2 (team). That's the
highest-leverage install and touches nothing but `.git/hooks` and one workflow file.

---

## 3. The pass-through matrix (the SDK surface)

Every capability is exposed identically across surfaces. The **library is the SDK**;
`--json` on every verb is the machine-composable pass-through; MCP is an optional
thin wrapper. The conformance suite guarantees all four runtimes behave identically,
so this one table *is* the SDK reference.

| Capability | CLI verb | Node fn | Python fn | Rust fn | `--json` out | File schema | (opt) MCP tool |
|---|---|---|---|---|---|---|---|
| validate belief-log | `belief validate <log>` | `belieflog.validateFile` | `belieflog.validate_file` | `validate_file` | `{valid, failures[]}` | [`belief-log.schema.json`](../spec/belief-log.schema.json) | `belief_validate` |
| append belief event | `belief append <log> …` | `belieflog.append` | `belieflog.append` | — | `{appended}` | same | `belief_append` |
| drift-check | `drift-check --manifest <m>` | `manifest.driftCheck` | `manifest.drift_check` | `drift_check` | `{ok, verdicts{}}` | [`manifest.schema.json`](../spec/manifest.schema.json) | `drift_check` |
| serializability | `serializability [--strict]` | `git.serializabilityCheck` | *(roadmap)* | *(roadmap)* | `{clean, warnings[]}` | manifest | `serializability` |
| compact / seed | `compact …` | `handoff.assemble`/`render` | *(roadmap)* | — | `{frontMatter, markdown}` | [`handoff.schema.json`](../spec/handoff.schema.json) | `compact` |
| pickup prompt | `pickup <handoff.md>` / `compact --prompt` | `handoff.pickupPrompt` | *(roadmap)* | — | text | handoff | `pickup` |
| docset compare | `docset-cmp <a> <b>` | `docset.compareDocset` | `docset.compare_docset` | `compare_docset` | `{cmp}` | — | — |

Contract stability: verbs, flags, and JSON keys in this table are **stable within a
minor version**. Additions are additive; removals require a major bump.

*(roadmap)* = spec'd, in Node today, port pending — tracked as conformance fixtures
so a port can't claim the capability until it passes.

---

## 4. Adapter recipes

### Claude Code plugin / skill
A `/handoff` skill calls `germinate compact --out SESSION-HANDOFF.md` at session
end; `/handoff-pickup` calls `germinate pickup SESSION-HANDOFF.md` and feeds the
prompt back. See [`../adapters/claude-code/`](../adapters/claude-code/). Cursor and
Aider are the same shape — a start hook and an end hook over the same two verbs.

### GitHub Action (Tier 2)
```yaml
- uses: flashesofbrilliance/germinate/.github/actions/drift-check@v0
  with:
    manifest: manifest.json
```
The composite action is at [`../.github/actions/drift-check/action.yml`](../.github/actions/drift-check/action.yml).

### MCP server (optional)
A thin server exposing the core fns as tools, for agents that prefer to *call*
germinate rather than shell out. Documented, not part of the dependency-light
core. Tool names are the last column of the matrix above.

### Hosted microservice (infra-agnostic)
Wrap the same functions in any handler — an AWS Lambda, a Vercel **Fluid Compute**
route (Node.js, not Edge), a Cloudflare Worker, a LangChain `Tool`, a FastAPI route.
The core never imports the platform.

---

## 5. Config file (optional)

Place a `.germinate.json` at the repo root to set defaults so commands need no
flags:

```json
{
  "manifest": "docs/manifest.json",
  "belieflog": "docs/belieflog.jsonl",
  "docsetVersion": "2026-08-13-build.1"
}
```
