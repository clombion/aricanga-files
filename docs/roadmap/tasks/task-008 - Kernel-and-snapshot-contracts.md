---
id: task-008
title: Kernel and snapshot contracts
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [foundation, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-001]
parent_task_id:
---

## Description

Define the vocabulary-agnostic core: `StoryChunk`/`Tag`/`Choice` (what ink
emits), the `reduce(state, chunk, ctx) → { state, effects }` signature,
`ReduceContext` (injected clock + deterministic id), and `Snapshot<TSystemState>`.
See [`../phase-1-foundation-design.md`](../phase-1-foundation-design.md).

## Acceptance Criteria

- [ ] #1 `Snapshot<TSystems>` keys opaque system slices by id (`systems`), supports one or more systems, and references no chat- or card-specific field (ADR-0005)
- [ ] #2 `StoryChunk`, `Tag`, and `Choice` represent ink output without naming any chat or card concept
- [ ] #3 The `reduce` signature is `(state, chunk, ctx) => { state, effects }` and the type forbids returning the input state mutated (readonly inputs)
- [ ] #4 `ReduceContext` exposes `now` and `nextId` only; nothing in the core imports `Date`/`Math.random`/IO
- [ ] #5 A sample `Snapshot` round-trips through serialize → deserialize preserving deep equality
- [ ] #6 Everything compiles under strict TypeScript with no `any` in the public surface

## Implementation Plan

`packages/foundation/src/sim/contracts.ts`; type-only, no runtime yet.

## Implementation Notes

_None yet._
