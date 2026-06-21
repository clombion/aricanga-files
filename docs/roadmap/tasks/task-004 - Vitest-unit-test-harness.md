---
id: task-004
title: Vitest unit-test harness
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
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

## Tests

- **Classes:** guard (meta — this task builds the harness)
- guard/smoke (pre-commit): #1, #2 — an example unit test and a happy-dom component test run green
- guard/tripwire (CI): #4 — a deliberately failing test makes `vitest run` exit non-zero

> Carve-out: the harness proves itself by running and by failing correctly.

## Implementation Plan

`vitest.config.ts` with happy-dom environment for component tests; workspace
alias inheritance from Vite.

## Implementation Notes

Separate `vitest.rebuild.config.ts` (happy-dom env, workspace src aliases) kept
apart from the POC's `vitest.config.ts`; script `test:rebuild`. An example unit
test (foundation, imported via the `@narratives/foundation` specifier — AC #3) and
a happy-dom component test (`sk-message`) both pass. Test files are excluded from
the tsc lib build (`exclude: **/*.test.ts`). `vitest run` is non-interactive and
its exit code reflects pass/fail (AC #4).
