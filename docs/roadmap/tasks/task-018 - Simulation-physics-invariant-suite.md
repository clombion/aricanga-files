---
id: task-018
title: Simulation-physics invariant suite (property-based)
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, testing, phase-2]
milestone: "Phase 2 — Chat simulation kernel (headless)"
dependencies: [task-017]
parent_task_id:
---

## Description

Encode every invariant from `docs/concepts/simulation-physics.md` as
property-based tests over generated chunk/choice sequences — **written before the
kernel exists** (red), so it is the acceptance target that drives tasks 020–026
to green.

## Acceptance Criteria

- [ ] #1 Each documented invariant has a property test (routing ownership, notify-once, forward-only time, HWM correctness, receipt monotonicity, seed exclusion)
- [ ] #2 Tests generate randomized sequences, not just fixed examples
- [ ] #3 The suite starts RED against an empty/stub kernel and is the acceptance target for 020–026
- [ ] #4 A failing case shrinks to a minimal reproducing sequence
- [ ] #5 Example count is capped pre-commit; a deep run goes nightly

## Tests

This task **is** test code; its deliverable is the property suite.

- **Classes:** behaviour
- behaviour/property (CI; deep nightly): #1, #2, #4 — invariants hold over generated input; shrinking yields minimal counterexamples
- guard/tripwire (pre-commit): #3 — the suite is wired and fails against the stub kernel

## Implementation Plan

A property-testing lib (e.g. fast-check) over the task-017 harness.

## Implementation Notes

_None yet._
