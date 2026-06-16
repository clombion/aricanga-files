# Phase 2 — Chat simulation kernel (headless)

**Labels:** `type:epic`, `area:chat`
**Blocked by:** Phase 1 · **Blocks:** Phase 3

## Risk retired

We can't reproduce the crown-jewel physics as pure logic.

## Goal

Port the simulation into the pure reducer:

- Routing + `targetChat` override
- Deferred-message queue
- Emergent notifications (arise from state, not imperative commands)
- High-Water-Mark / read cursors
- Forward-only time coherence
- Read receipts (incl. automatic upgrade)
- Seeds (build-time backstory, no notifications)
- Message grouping derivation

No DOM, no event bus inside it — side effects come out as `effects[]` data.
Encode every invariant from `docs/concepts/simulation-physics.md` as
property/unit tests.

## Proof / Definition of Done

The kernel replays Aricanga's ink in Node and produces the correct effect
stream; the invariant suite is real and passing (no vacuous `expect(true)`
tests).

## Subtasks

- [ ] (added when we break down this phase)

## Non-goals

No rendering — headless only.
