---
id: task-043
title: Per-locale ink compile to JSON
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [build, phase-4]
milestone: "Phase 4 — Build pipeline & config"
dependencies: [task-042]
parent_task_id:
---

## Description

Compile each locale's ink to story JSON as a deterministic, content-addressed build step.

## Acceptance Criteria

- [ ] #1 Each configured locale's ink compiles to story JSON via the bundled compiler
- [ ] #2 A compile error fails the build with file and line
- [ ] #3 Output is deterministic — identical source yields identical JSON — and content-hashed
- [ ] #4 Compiled output is excluded from VCS and produced by the build

## Tests

- **Classes:** guard (+ constraint)
- guard/smoke (CI): #1, #2 — en + fr compile; a planted ink error fails with location
- constraint/architecture (CI): #3 — re-running the compile yields byte-identical JSON

## Implementation Plan

`packages/build/src/compile-ink.ts` over the bundled inklecate / inkjs compiler.

## Implementation Notes

_None yet._
