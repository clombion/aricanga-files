---
id: task-012
title: Composition root
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [foundation, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-011]
parent_task_id:
---

## Description

Define `createExperience({ storyUrl, system, services })` — the one place that
instantiates instance-scoped services (clock, storage, analytics, bus), wires the
chosen system, loads the story, and owns the host loop. Replaces the POC's global
singletons.

## Acceptance Criteria

- [ ] #1 `createExperience` takes a `System` and a `Services` bundle and returns a running experience handle
- [ ] #2 All services are created per call — no module-level singletons (`grep` for exported singleton instances returns none in foundation)
- [ ] #3 Two experiences can be created in the same process with fully isolated state
- [ ] #4 Swapping the `system` argument requires no change to `createExperience` or any foundation file
- [ ] #5 Services are injectable, so a test can pass a fake clock/storage/bus

## Implementation Plan

`packages/foundation/src/core/create-experience.ts`; constructor-injected services.

## Implementation Notes

_None yet._
