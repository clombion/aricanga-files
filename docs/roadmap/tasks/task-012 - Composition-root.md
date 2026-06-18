---
id: task-012
title: Composition root
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [foundation, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-011, task-016]
parent_task_id:
---

## Description

Define `createExperience({ storyUrl, systems, foreground?, router?, services })` —
the one place that instantiates instance-scoped services (clock, storage,
analytics, bus), wires the chosen system(s) through a registry + `Router`
(ADR-0005), loads the story, and owns the host loop. Replaces the POC's global
singletons.

## Acceptance Criteria

- [ ] #1 `createExperience` takes `systems: System[]` (plus optional `foreground`/`router`) and a `Services` bundle and returns a running experience handle
- [ ] #2 All services are created per call — no module-level singletons (`grep` for exported singleton instances returns none in foundation)
- [ ] #3 Two experiences can be created in the same process with fully isolated state
- [ ] #4 Adding, removing, or swapping a system in the `systems` array requires no change to `createExperience` or any foundation file
- [ ] #5 Services are injectable, so a test can pass a fake clock/storage/bus
- [ ] #6 A single-system experience works as the degenerate case — `systems` of length one, router returns it, no special-casing

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (CI): #1, #3, #6 — `createExperience` returns a running handle; two experiences run with isolated state; a single-system experience works as the degenerate case
- behaviour/example (pre-commit): #5 — injecting fake clock/storage/bus works
- constraint/architecture (pre-commit): #2, #4 — static check: no exported singletons; adding/swapping a system touches no foundation file

## Implementation Plan

`packages/foundation/src/core/create-experience.ts`; constructor-injected services.

## Implementation Notes

_None yet._
