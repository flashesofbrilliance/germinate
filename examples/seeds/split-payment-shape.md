---
kind: seed
schema_version: 1
id: split-payment-shape
seed_type: problem-shape
soil:
  - marketplace
  - payments
  - split
tags:
  - connect
  - payout
antipatterns:
  - b2c
  - single-tenant
provenance:
  minted_from: germinate example seed
  note: generic, clean-room — no client specifics
---
# Split-payment marketplace shape

When money flows between two parties on your platform (a buyer, a seller, and you in the
middle), you need split payments / connected accounts — not a single charge. Route funds
to the seller, take your fee, and never serve one side of the market without the other.

**Surfaces when** your context mentions marketplace / payments / split (see `soil`).
**Suppressed** for `b2c` or `single-tenant` contexts (see `antipatterns`) — there's no
second party to route to, so this shape would mislead.

This is an example of the seed format. `germinate sprout --context "…"` will surface it
only where its soil matches and no antipattern vetoes.
