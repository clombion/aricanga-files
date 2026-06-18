---
id: task-019
title: BUG-HISTORY regression suite
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

Port each historical bug in `docs/agents/BUG-HISTORY.md` into a regression /
tripwire test on the new kernel, so known failures stay dead through the rewrite.

## Acceptance Criteria

- [ ] #1 Every entry in BUG-HISTORY.md maps to a named regression test, or is explicitly marked not-applicable to the new architecture
- [ ] #2 Each test reproduces the original failing condition headlessly and asserts the fixed behaviour
- [ ] #3 Each test references its bug id for traceability
- [ ] #4 The suite runs in CI

## Tests

This task **is** test code; coverage is measured against BUG-HISTORY entries.

- **Classes:** guard (regression)
- guard/regression (CI): #1, #2, #3 — each historical bug has a headless test asserting the fix, tagged by id

## Implementation Plan

One test per bug id over the task-017 harness; a checklist mapping ids → tests.

## Implementation Notes

_None yet._
