---
id: task-011
title: System interface
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
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

## Implementation Plan

`packages/foundation/src/sim/system.ts`.

## Implementation Notes

_None yet._
