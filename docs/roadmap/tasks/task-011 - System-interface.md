---
id: task-011
title: System interface
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
labels: [foundation, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-008, task-009, task-010]
parent_task_id:
---

## Description

Define the `System<TSystemState, TViewModel>` contract every system implements:
`id`, claimed `tags`, `init()`, `reduce()`, `deriveViewModel()`, and
`registerComponents()`. This is the seam that keeps foundation vocabulary-agnostic.

## Acceptance Criteria

- [ ] #1 `System<TState, TViewModel>` declares `id`, `tags`, `init`, `reduce`, `deriveViewModel`, and `registerComponents`
- [ ] #2 `reduce` and `deriveViewModel` are typed as pure (readonly inputs, no `void` side-effect return)
- [ ] #3 `deriveViewModel` returns the opaque `TViewModel`; foundation never inspects its shape
- [ ] #4 The interface references only foundation types (`StoryChunk`, `Effect`, `ReduceContext`) — never a chat or card type
- [ ] #5 The interface compiles and is exported from the foundation public surface

## Tests

- **Classes:** constraint
- constraint/compile (pre-commit): #1, #2, #3, #5 — the interface compiles with pure signatures and an opaque `TViewModel`; exported from the public surface
- constraint/architecture (pre-commit): #4 — static check: the interface imports no chat/card type

> Carve-out: contract task — compile + the two stubs (task-013/014) conforming are the test.

## Implementation Plan

`packages/foundation/src/sim/system.ts`.

## Implementation Notes

Implemented in the Phase 1 contract set; verified by tsc, boundary lint, 11 tests, and build. The two-vocabulary proof routes by tag-ownership and the cards addition touched zero foundation source.
