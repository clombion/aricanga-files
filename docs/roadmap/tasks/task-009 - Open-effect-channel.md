---
id: task-009
title: Open effect channel
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [foundation, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-008]
parent_task_id:
---

## Description

Define the extensible `Effect<K, P>` envelope, the foundation-level effect set
(`FoundationEffect`: save, advanceTime, requestData, emit), and the host-side
effect-executor registry that maps `kind → handler`. Systems must be able to add
effect kinds without foundation referencing them.

## Acceptance Criteria

- [ ] #1 `Effect<K extends string, P>` is defined; `FoundationEffect` enumerates only foundation-owned kinds
- [ ] #2 A system can declare its own effect kinds in its own module with no edit to foundation
- [ ] #3 The host executor is a `Record<kind, handler>` merged from foundation + the active system; an unknown kind is a typed error, not a silent no-op
- [ ] #4 A chat-style effect (`chat/showNotification`) and a cards-style effect (`cards/statChanged`) both type-check through the same channel
- [ ] #5 No `console.log` placeholder effects; every effect kind has a real handler or is explicitly unimplemented via a typed stub

## Implementation Plan

`packages/foundation/src/sim/effects.ts` + a host `createEffectExecutor()`.

## Implementation Notes

_None yet._
