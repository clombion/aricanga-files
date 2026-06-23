---
id: task-062
title: Reshape the merged Phase 1 foundation to the algebra
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [foundation, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-040, task-041]
parent_task_id:
---

## Description

The Phase 1 foundation (tasks 008–016) was built and merged against the
pre-algebra contract — `reduce(state, chunk, ctx)` over `StoryChunk`, a snapshot
that serializes ink, a standalone effect executor, and a `System` interface that
mixes in view registration. ADR-0007 supersedes that contract. task-040 defines
the new types and task-041 builds the generic runtime; this task migrates the
**existing merged artifacts** onto them so the foundation matches the algebra
rather than a stub conforming at the type level only.

This is the substantive reshape, not the type definition (040) or the new
runtime (041). It is its own task because it edits already-merged, already-tested
code: every change must keep `foundation` vocabulary-agnostic and re-green the
existing suites.

## Acceptance Criteria

- [ ] #1 `System` is migrated to the task-040 shape: `reduce(state, input, ctx)`, `init(seed)`, `view(state, render)`, `status(state)`; `registerComponents`/view-registration is removed from the kernel contract (it moves to the view layer)
- [ ] #2 `Snapshot` carries no ink serialization and no wall-clock — `ink: string` is removed; ink lives host-side (task-041); `version` + `seed` remain
- [ ] #3 The standalone `host/effect-executor.ts` is retired or folded into the task-041 runtime executor; no two executors coexist
- [ ] #4 `sim/router.ts` routes the `Input` union (not `StoryChunk`) and `core/create-experience.ts` wires the task-041 runtime; `ink/ink-runtime.ts` is the host-owned ink wrapper
- [ ] #5 The chat and cards stubs and the two-vocabulary proof pass against the migrated foundation; no `foundation` module imports a system type
- [ ] #6 The existing foundation test suites (`contracts.test.ts`, `index.test.ts`) are updated and green; no dead code from the old contract remains

## Tests

- **Classes:** constraint (+ behaviour)
- constraint/compile (pre-commit): #1, #2, #5 — the migrated contract types total; snapshot has no `ink`; stubs + proof conform
- behaviour/example (pre-commit): #3, #4 — a fixture run drives the migrated router + runtime; one executor path
- constraint/architecture (pre-commit): #5, #6 — boundary lint passes; no old-contract symbols (`StoryChunk` reduce, `deriveViewModel`, `registerComponents`, snapshot `ink`) remain

## Implementation Plan

Edit `packages/foundation/src/sim/{system,snapshot,router}.ts`,
`core/create-experience.ts`, `host/effect-executor.ts`, `ink/ink-runtime.ts`;
update `systems/chat` + `systems/cards` stubs and the foundation tests.

## Implementation Notes

_None yet._
