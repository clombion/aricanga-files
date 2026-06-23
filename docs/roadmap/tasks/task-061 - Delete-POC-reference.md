---
id: task-061
title: Delete the POC reference
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [hardening, cleanup, phase-7]
milestone: "Phase 7 — Hardening & standing guards"
dependencies: [task-057, task-058, task-059, task-060]
parent_task_id:
---

## Description

Retire the POC reference so the rebuild no longer lingers as a parallel
half-thing: delete the old `packages/framework`, the old `experiences/aricanga`
implementation, and POC-era concept docs once every guarantee they oracled is
covered by the new suites.

## Acceptance Criteria

- [ ] #1 The POC reference code (`packages/framework`, old experience source) is deleted
- [ ] #2 Every behaviour the POC oracled is covered by a regression/invariant test in the new suites (tasks 018, 019, 027)
- [ ] #3 No new code imports POC reference modules; the boundary lint for the reference is removed as dead
- [ ] #4 The build, typecheck, lint, and full test suite are green after deletion

## Tests

- **Classes:** guard (+ constraint)
- guard/smoke (CI): #4 — full pipeline green with the reference gone
- constraint/architecture (PR): #1, #2, #3 — reference removed; oracle coverage cross-referenced; no dangling imports

## Implementation Plan

Remove POC packages/experience/docs; confirm coverage cross-reference before deletion.

## Implementation Notes

_None yet._
