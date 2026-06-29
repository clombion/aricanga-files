---
id: task-058
title: Event-sourced analytics over the Effect stream
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [hardening, analytics, phase-7]
milestone: "Phase 7 — Hardening & standing guards"
dependencies: []
parent_task_id:
---

## Description

Analytics as a pure consumer of the kernel's `Effect` stream (and emitted domain
events): the host routes the existing effect/event stream to an analytics sink
with no new kernel surface and no impure calls inside any system.

## Acceptance Criteria

- [ ] #1 Analytics derives entirely from the existing `Effect`/event stream — no new kernel inputs or effects
- [ ] #2 The analytics sink is host-owned and injected; systems emit no analytics calls directly
- [ ] #3 The same input stream produces the same analytics events (deterministic, reproducible)
- [ ] #4 Disabling the sink removes all analytics IO with no change to kernel behaviour

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (CI): #1, #3 — a fixture run yields a deterministic analytics event sequence
- constraint/architecture (CI): #2, #4 — no system references the sink; toggling it is host-only

## Implementation Plan

`foundation/services` analytics sink fed by the host from the effect/event stream.

## Implementation Notes

_None yet._
