---
id: task-062
title: Reshape the merged Phase 1 foundation to the algebra
status: Done
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-28
labels: [foundation, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-040, task-041]
parent_task_id:
---

## Description

The Phase 1 foundation (tasks 008–016) was built and merged against the
pre-algebra contract — `reduce(state, chunk, ctx)` over `StoryChunk`, a snapshot
that serializes ink, a standalone effect executor, a push-based
`Experience.dispatch(chunk)`, and a `System` interface that mixes in view
registration. ADR-0007 supersedes that contract. task-040 defines the new types
and task-041 builds the generic runtime; this task migrates the **existing merged
artifacts** onto them so the foundation matches the algebra rather than a stub
conforming at the type level only.

This is the substantive reshape, not the type definition (040) or the new
runtime (041). It is its own task because it edits already-merged, already-tested
code: every change must keep `foundation` vocabulary-agnostic and re-green the
existing suites.

## Acceptance Criteria

- [ ] #1 `System` is migrated to the task-040 shape: `reduce(state, input, ctx)`, `init(seed)` (the current zero-arg `init` gains and, for the stubs, ignores the seed), `view(state, render)`, `status(state)` (stubs report `free`); `registerComponents`/view-registration is removed from the kernel contract
- [ ] #2 `Snapshot` is the host-owned envelope `{ version, ink, state, idSeq }`: the per-system map is `state` (renamed from `systems`); `ink` is the host's ink serialization; `idSeq` is the runtime's persisted id position; the per-system `state` holds no ink and no wall-clock
- [ ] #3 The standalone `host/effect-executor.ts` is retired or folded into the task-041 runtime executor; no two executors coexist
- [ ] #4 `sim/router.ts` routes the `Input` union (not `StoryChunk`); `core/create-experience.ts` wires the task-041 runtime and exposes `send(input)` with an internal ink pump and a single-step test seam (`dispatch(chunk)` is retired); `ink/ink-runtime.ts` is the host-owned ink wrapper returning `InkStep`
- [ ] #5 The chat and cards stubs and the two-vocabulary proof pass against the migrated foundation; the proof drives the runtime via `Story(InkStep)`/`Player` inputs (not `dispatch`); `chat/reduce.ts` (`reduceChunk`) is retyped to `InkStep` and called from the migrated `reduce`; no `foundation` module imports a system type
- [ ] #6 The existing foundation + sandbox suites are updated and green (`contracts.test.ts`, `index.test.ts`, chat `reduce.test.ts`, sandbox `skeleton.test.ts` retargeted, `two-vocabulary.test.ts` rewritten); no old-contract symbols remain

## Tests

- **Classes:** constraint (+ behaviour)
- constraint/compile (pre-commit): #1, #2 — the migrated contract types total; the snapshot envelope is `{ version, ink, state, idSeq }`; per-system state has no `ink`
- behaviour/example (pre-commit): #3, #4, #5 — a fixture run drives the migrated router + runtime via `send(input)`; one executor path; tag-ownership routing in the rewritten proof is intact
- constraint/architecture (pre-commit): #5, #6 — boundary lint passes; no old-contract symbols remain across `packages/foundation/src`, `packages/systems`, `experiences/sandbox/src`: `deriveViewModel`, `registerComponents`, `dispatch`, `ReduceContext.now`/clock-in-reduce, and `Snapshot.ink` in per-system state. The `StoryChunk` type and the `createIdSequence` function (with their `index.ts` barrel exports) are deleted by task-040; this task removes their *consumers*, so the `StoryChunk`/`createIdSequence` grep-clean is satisfied jointly with 040. The `Snapshot` `seed`→`idSeq` and `systems`→`state` renames are covered by the compile-total criterion above.

## Implementation Plan

Edit `packages/foundation/src/sim/{system,snapshot,router}.ts`,
`core/create-experience.ts`, `host/effect-executor.ts`, `ink/ink-runtime.ts`;
migrate `systems/chat/src/{system,reduce,state}.ts` (+ `reduce.test.ts`) and
`systems/cards/src/system.ts`; rewrite `experiences/sandbox/src/two-vocabulary.test.ts`,
retarget `main.ts` + `skeleton.test.ts`, update `contracts.test.ts` + `index.test.ts`.

## Implementation Notes

- `core/create-experience.ts` is a thin composition over `Runtime`
  (`send`/`step`/`view`/`snapshot`/`restore`); `host/effect-executor.ts` is
  deleted (one executor path).
- `Snapshot` is the host envelope `{ version, ink, idSeq, state }`.
- chat/cards stubs reduce over `Input` (story branch only), `status() => 'free'`,
  `view(state, render)`, `init(seed)`; notifications/stat changes emit `Present`
  effects; `reduceChunk` → `reduceStep(step: InkStep)`.
- The two-vocabulary proof drives the runtime through real ink + tag-ownership
  routing (a recording `present` host); the walking skeleton uses
  `canContinue`/`continue`.
- Verified green: `tsc -b`, `lint:boundaries`, `test:rebuild` (21), and the
  sandbox `vite build`. Grep-clean confirmed over the reshaped surface.
