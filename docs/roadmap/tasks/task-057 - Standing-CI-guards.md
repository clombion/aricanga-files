---
id: task-057
title: Standing CI guards (exhaustiveness, purity, determinism, boundary, a11y)
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [hardening, ci, phase-7]
milestone: "Phase 7 — Hardening & standing guards"
dependencies: [task-051, task-056]
parent_task_id:
---

## Description

Promote the algebra's guarantees (ADR-0007) to standing CI gates so they hold for
all systems going forward: exhaustiveness of every `Input`/`Effect` union, purity
of every reducer/view, run-twice determinism, module boundaries, and a11y.

## Acceptance Criteria

- [ ] #1 Exhaustiveness: a missing `Input`/`Effect` case in any system fails the typecheck gate
- [ ] #2 Purity: a `Date.now`/`Math.random`/locale read inside any `reduce`/`view` fails a lint gate
- [ ] #3 Determinism: a run-twice deep-equal check over each system's golden inputs runs in CI
- [ ] #4 Boundary + a11y gates run on every PR and block on failure
- [ ] #5 Each guard names the ADR-0007 property it enforces and points to its source

## Tests

- **Classes:** guard (standing gates)
- guard/tripwire (CI): #1, #2, #3 — planted violations (missing case, `Date.now` in a reducer, nondeterministic output) each fail their gate
- guard/smoke (CI): #4 — boundary + axe gates execute on PR

## Implementation Plan

Consolidate gates in `eslint.config.js`, the typecheck step, and `vitest` determinism specs wired into the rebuild CI workflow.

## Implementation Notes

_None yet._
