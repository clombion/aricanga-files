---
id: task-052
title: Cards Input/Effect algebra + completeness check
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [experience, cards, phase-6]
milestone: "Phase 6 — Cards-on-phone experience"
dependencies: [task-041, task-047]
parent_task_id:
---

## Description

Define the cards system as a second closed `Input`/`Effect` algebra over the same
generic runtime: the full set of inputs (story step, player swipe/choice,
lifecycle) and effects (drive ink, schedule, present, persist) for a card-game
vocabulary. This proves the boundary is a reusable algebra, not a chat artifact.

## Acceptance Criteria

- [ ] #1 Cards `Input` and `Effect` are closed discriminated unions distinct from chat's
- [ ] #2 An exhaustiveness check (`assertNever`) makes a missing `Input`/`Effect` case a compile error
- [ ] #3 The cards system implements the same `System<State, Input, Effect, ViewModel>` interface as chat
- [ ] #4 Cards reuse the generic runtime and effect executor contract with no runtime fork

## Tests

- **Classes:** constraint
- constraint/compile (pre-commit): #2 — removing a case fails the exhaustiveness check
- constraint/contract (CI): #1, #3 — cards satisfy the `System` interface; algebras are disjoint
- constraint/architecture (CI): #4 — cards depend on the generic runtime, not a copy

## Implementation Plan

`packages/systems/cards/src/algebra.ts`; mirror chat's `System` conformance.

## Implementation Notes

_None yet._
