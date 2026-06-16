---
id: task-014
title: Cards system stub
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
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

## Implementation Plan

`packages/systems/cards/src/index.ts`; minimal deck of inline cards.

## Implementation Notes

_None yet._
