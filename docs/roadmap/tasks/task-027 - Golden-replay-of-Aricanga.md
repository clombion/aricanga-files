---
id: task-027
title: Golden replay of Aricanga (phase proof)
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, testing, phase-2]
milestone: "Phase 2 — Chat simulation kernel (headless)"
dependencies: [task-020, task-021, task-022, task-023, task-024, task-025, task-026]
parent_task_id:
---

## Description

The Phase 2 integrating proof: replay Aricanga's compiled ink headlessly through
the full kernel and pin the resulting effect stream as a golden reference. Retires
the "can we reproduce the crown-jewel physics as pure logic" risk.

## Acceptance Criteria

- [ ] #1 Aricanga's ink replays end-to-end in Node through the real kernel with no DOM
- [ ] #2 The full property suite (task-018) and regression suite (task-019) pass green
- [ ] #3 The produced effect stream matches a reviewed golden reference
- [ ] #4 A guided run of key story paths matches expected per-chat message ownership and notification counts

## Tests

This task **is** the Phase 2 acceptance test.

- **Classes:** behaviour
- behaviour/golden (CI): #1, #3 — Aricanga replay matches the pinned effect stream
- behaviour/property (CI; deep nightly): #2 — the invariant + regression suites pass
- behaviour/example (CI): #4 — guided-path assertions on ownership and notification counts

> Mutation testing on the kernel runs nightly to validate this suite's strength
> (see testing-strategy.md).

## Implementation Plan

Reuse the task-017 harness against Aricanga's compiled story; commit the golden.

## Implementation Notes

_None yet._
