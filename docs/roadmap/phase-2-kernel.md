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

See [`tasks/`](tasks/README.md) for the full task files; testing approach in
[`testing-strategy.md`](testing-strategy.md). TDD-led — suites first (red), then
physics to green.

- [ ] task-017 — Kernel test harness and fixtures
- [ ] task-018 — Simulation-physics invariant suite (property-based)
- [ ] task-019 — BUG-HISTORY regression suite
- [ ] task-020 — Message routing and targetChat
- [ ] task-021 — Deferred queue and emergent notifications
- [ ] task-022 — HWM read cursors and unread separator
- [ ] task-023 — Forward-only time coherence
- [ ] task-024 — Read receipts
- [ ] task-025 — Seeds
- [ ] task-026 — Message grouping derivation
- [ ] task-027 — Golden replay of Aricanga (phase proof)

## Non-goals

No rendering — headless only.
