---
id: task-047
title: Retire parity linters in favour of the schema; wire the build into CI
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [build, tooling, ci, phase-4]
milestone: "Phase 4 — Build pipeline & config"
dependencies: [task-042, task-043, task-044, task-045, task-046]
parent_task_id:
---

## Description

Collapse the POC's bespoke config↔ink↔i18n parity linters into the schema and
build derivations, and wire the full typed pipeline (config validate → ink
compile → seeds → i18n/data → images) into CI as a single reproducible step.

## Acceptance Criteria

- [ ] #1 The bespoke parity linters are removed; their guarantees are covered by schema/derivation checks (tasks 042, 044, 045)
- [ ] #2 The full build runs as one command and fails closed on any invalid input with a located error
- [ ] #3 CI runs the build on a fixture experience and asserts the emitted world is well-formed and deterministic
- [ ] #4 No governance check is duplicated between a linter and the schema

## Tests

- **Classes:** guard (+ constraint)
- guard/smoke (CI): #2, #3 — the pipeline builds a fixture experience end to end; a re-run is byte-identical
- constraint/architecture (pre-commit): #1, #4 — the retired linters are gone and no parity check is duplicated

## Implementation Plan

`packages/build/src/pipeline.ts` orchestrates the steps; CI invokes it over a fixture experience.

## Implementation Notes

_None yet._
