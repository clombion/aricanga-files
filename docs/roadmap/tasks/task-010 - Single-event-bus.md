---
id: task-010
title: Single event bus and DomainEvent envelope
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

Define the single `EventBus` (`emit`/`on`) and the `DomainEvent` envelope used
for cross-cutting sinks only — analytics and cross-system coordination — fed by
the `foundation/emit` effect. This replaces the POC's four overlapping
mechanisms.

## Acceptance Criteria

- [ ] #1 `EventBus` exposes typed `emit(event)` and `on(type, handler)` returning an unsubscribe function
- [ ] #2 The bus is instance-scoped (created in the composition root), not a module singleton
- [ ] #3 A `foundation/emit` effect placed on the bus reaches a registered subscriber
- [ ] #4 Rendering does NOT depend on the bus — a view-model derives purely from state (documented and demonstrated by a test)
- [ ] #5 Two subscribers (e.g. analytics + a second system) both receive an emitted event

## Implementation Plan

`packages/foundation/src/services/event-bus.ts`; map of type → handler set.

## Implementation Notes

_None yet._
