---
description: Resume from a germinate seed — drift-check then emit the pickup prompt
---

Pick up the previous session using the `germinate` CLI. Steps:

1. Confirm surfaces agree before trusting anything:
   ```
   germinate drift-check --manifest manifest.json
   ```
   If it exits non-zero, surface the STALE / OUT_OF_SYNC / MISSING verdicts to the
   user first — the seed's claims may be stale.
2. Emit the cold-start pickup prompt from the latest handoff:
   ```
   germinate pickup SESSION-HANDOFF.md
   ```
3. Read the prompt's "START HERE" and open threads, then read the referenced
   belief-log tail for the trace of how understanding formed.
4. Begin at the START HERE pointer. Treat recalled beliefs as *what was true when
   written* — verify anything the seed asserts about live state (files, deploys,
   domains) before acting on it.
