---
id: task-004
title: Vitest unit-test harness
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [tooling, testing, phase-0]
milestone: "Phase 0 — Walking skeleton & toolchain"
dependencies: [task-001]
parent_task_id:
---

## Description

Configure Vitest for two test modes: headless unit tests (kernel/foundation
logic in Node) and component tests (Lit elements in happy-dom), with workspace
package resolution.

## Acceptance Criteria

- [ ] #1 `vitest run` executes a passing example unit test against a foundation module
- [ ] #2 A component test renders a Lit element in happy-dom and asserts shadow-DOM content
- [ ] #3 Tests resolve workspace package imports without manual path hacks
- [ ] #4 `vitest run` is non-interactive and exits non-zero on failure (CI-ready)

## Implementation Plan

`vitest.config.ts` with happy-dom environment for component tests; workspace
alias inheritance from Vite.

## Implementation Notes

_None yet._
