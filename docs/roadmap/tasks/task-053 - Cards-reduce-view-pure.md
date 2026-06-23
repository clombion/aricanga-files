---
id: task-053
title: Cards reduce + view (pure)
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [experience, cards, phase-6]
milestone: "Phase 6 — Cards-on-phone experience"
dependencies: [task-052]
parent_task_id:
---

## Description

Implement the cards `reduce(state, input) → {state, effects}` and
`view(state, renderContext) → viewModel` as pure functions: deck/stat physics in
the reducer, presentation in the view. No wall-clock, no randomness outside
seeded ids, no IO.

## Acceptance Criteria

- [ ] #1 `reduce` is pure and deterministic — same `(state, input)` yields the same `(state, effects)`
- [ ] #2 `view` is pure — derives the card/stat `ViewModel` from state + render context only
- [ ] #3 Card outcomes and stat changes are reproducible from the input stream alone (seeded ids; no `Date.now`/`Math.random`)
- [ ] #4 All player actions enter as `Input`s; effects describe, never perform

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/property (CI): #1, #3 — replaying an input stream twice yields deep-equal state + effects
- behaviour/example (CI): #2, #4 — sample states render expected view-models; actions produce expected effects
- constraint/architecture (pre-commit): #3 — purity lint over the reducer (no clock/random/locale)

## Implementation Plan

`packages/systems/cards/src/reduce.ts`, `view.ts`; seeded ids via `ReduceContext.nextId`.

## Implementation Notes

_None yet._
