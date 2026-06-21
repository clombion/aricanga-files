---
id: task-014
title: Cards system stub
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
labels: [cards, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-011]
parent_task_id:
---

## Description

A minimal `systems/cards` implementing `System` with a genuinely different
vocabulary from chat — the forcing function that keeps foundation honest. Defines
a `CardsState` slice (deck cursor + stats) and claims card/stat tags. No time
coherence, no HWM, no notifications.

## Acceptance Criteria

- [ ] #1 `cardsSystem` implements `System<CardsState, CardsViewModel>`
- [ ] #2 `CardsState` has no message/read/deferral concepts — only deck cursor, stats, and decision history
- [ ] #3 It claims card tags (`card`, `stat`) via `tags`
- [ ] #4 `reduce` applies a `stat` tag as a `cards/statChanged` effect and advances the deck — expressed entirely through foundation generics
- [ ] #5 Building this required ZERO edits to `foundation/`; if an edit was needed, it was a generalization recorded in Implementation Notes

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #1, #4 — the stub implements `System`; `reduce` applies a `stat` tag as `cards/statChanged` and advances the deck
- constraint/compile (pre-commit): #2 — `CardsState` has no message/read/deferral concepts and is expressed through foundation generics
- constraint/architecture (pre-commit): #3, #5 — claims card tags; building it required zero foundation edits

## Implementation Plan

`packages/systems/cards/src/index.ts`; minimal deck of inline cards.

## Implementation Notes

Implemented in the Phase 1 contract set; verified by tsc, boundary lint, 11 tests, and build. The two-vocabulary proof routes by tag-ownership and the cards addition touched zero foundation source.
