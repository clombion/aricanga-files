---
id: task-008
title: Kernel and snapshot contracts
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
labels: [foundation, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-001]
parent_task_id:
---

## Description

Define the vocabulary-agnostic core: `StoryChunk`/`Tag`/`Choice` (what ink
emits), the `reduce(state, chunk, ctx) → { state, effects }` signature,
`ReduceContext` (injected clock + deterministic id), and `Snapshot<TSystems>`.
See [`../phase-1-foundation-design.md`](../phase-1-foundation-design.md).

## Acceptance Criteria

- [ ] #1 `Snapshot<TSystems>` keys opaque system slices by id (`systems`), supports one or more systems, and references no chat- or card-specific field (ADR-0005)
- [ ] #2 `StoryChunk`, `Tag`, and `Choice` represent ink output without naming any chat or card concept
- [ ] #3 The `reduce` signature is `(state, chunk, ctx) => { state, effects }` and the type forbids returning the input state mutated (readonly inputs)
- [ ] #4 `ReduceContext` exposes `now` and `nextId` only; nothing in the core imports `Date`/`Math.random`/IO
- [ ] #5 A sample `Snapshot` round-trips through serialize → deserialize preserving deep equality
- [ ] #6 Everything compiles under strict TypeScript with no `any` in the public surface

## Tests

- **Classes:** constraint (+ light behaviour)
- constraint/compile (pre-commit): #1, #2, #3, #6 — `tsc --build` accepts the contracts; no chat/card leakage; readonly inputs; no `any` in the public surface
- constraint/architecture (pre-commit): #4 — a static check asserts `Date`/`Math.random`/IO are absent from the sim core
- behaviour/example (pre-commit): #5 — a sample `Snapshot` round-trips serialize → deserialize to deep-equal

> Carve-out: this is a contract task — the type-checker plus the chat/cards stubs
> (task-013/014) conforming to it *are* the test. No red-green example suite.

## Implementation Plan

`packages/foundation/src/sim/contracts.ts`; type-only, no runtime yet.

## Implementation Notes

Contracts in `packages/foundation/src/sim/`: `story.ts` (`Tag`/`Choice`/`StoryChunk`
+ `parseTag`), `effect.ts` (`Effect<K,P>` base), `snapshot.ts` (`SystemId`,
keyed `Snapshot<TSystems>`), `context.ts` (`ReduceContext`, `ReduceResult`, the
`Reduce` signature, and `createIdSequence` — xorshift32 seeded from the snapshot
seed, no `Math.random`). `InkRuntime` evolved to emit the rich `StoryChunk`
(parsed tags + choices); the Phase 0 stub `story-chunk.ts` removed; chat
`reduceChunk` updated to `Tag[]`.

Verified: `tsc -b`, eslint, 8 tests (incl. snapshot JSON round-trip and id
determinism), and `vite build` green; the sim core contains no
`Date.now`/`Math.random` (AC #4).
