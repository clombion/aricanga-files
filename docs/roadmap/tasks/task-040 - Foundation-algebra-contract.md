---
id: task-040
title: Foundation algebra contract
status: Done
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-28
labels: [foundation, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: []
parent_task_id:
---

## Description

Define the foundation's closed `Input`/`Effect` algebra and the pure-reducer `System` contract (ADR-0007). This is the generic framework every system implements; chat and cards are instances. The `Input` and `Effect` *families* are full at this point — the generic runtime (task-041) dispatches on all of them — while each system's command/effect *kinds* and `reduce` bodies start minimal and grow with the physics. See `phase-1-foundation-design.md`.

## Acceptance Criteria

- [ ] #1 `Input` is the closed union `Story(InkStep) | Player(Command) | Resume(CommitFired | DataArrived | StoryLoaded | Restored) | Lifecycle(Init | Reset)` — all four sources present at definition; `Command` is the open, system-addressed envelope `{ kind, payload }`
- [ ] #2 `Effect` is the closed capability family `DriveInk | Schedule | Fetch | Present | Persist`; each is the foundation envelope `{ kind, payload }` specialised per system — closed at system authorship (reduce exhaustiveness), open at the executor (`kind → handler`)
- [ ] #3 `InkStep = { text, tags, choices, externalCalls, status }` with `InkStatus = 'continue' | 'await-choice' | 'await-data' | 'end' | 'error'`; an `ExternalCall` type covers the drain-class ink externals
- [ ] #4 The ink-external contract is fixed in the types: `name`/`data` resolve into `InkStep.text` host-side and never reach the kernel as calls; `delay_next`/`play_sound`/`advance_day`/`request_data` are `ExternalCall`s, with `request_data` driving `status: 'await-data'`
- [ ] #5 `System` exposes `reduce(state, input, ctx)`, `status(state)`, `view(state, render)`, `init(seed)`; `reduce`/`view`/`status` are typed pure (readonly inputs, no `void` side-effect returns); the kernel contract carries no view-registration hook
- [ ] #6 `ReduceContext` is `{ nextId(): string }` only — no clock, no randomness; `RenderContext` is `{ now, locale }`; the id source is a host-owned monotonic allocator — no `Date.now`/`Math.random` and no in-contract id generator (`createIdSequence`/xorshift is removed)
- [ ] #7 An `assertNever` exhaustiveness helper exists; handling `Input`/`Effect` non-exhaustively fails to compile
- [ ] #8 The chat stub, cards stub, and the two-vocabulary proof compile against the new contract; foundation references no system type

## Tests

- **Classes:** constraint
- constraint/compile (pre-commit): #1, #2, #3, #5, #6, #8 — types total; stubs conform; no `any` in the public surface; no clock/id-generator in the contract
- constraint/compile (pre-commit): #7 — a deliberately non-exhaustive `Input`/`Effect` switch fails to compile (`never` check)
- constraint/contract (pre-commit): #4 — the `ExternalCall`/`InkStatus` types encode the external mapping (`name`/`data` are not `ExternalCall` members; `request_data` ↔ `await-data`)

## Implementation Plan

`packages/foundation/src/sim/{input,effect,system,context,story}.ts`; new `sim/exhaustive.ts` (`assertNever`). `story.ts`: `StoryChunk` → `InkStep` + `ExternalCall` + `InkStatus`. `context.ts`: drop `createIdSequence`; `ReduceContext = { nextId }`. The monotonic allocator backing `nextId` is owned by the runtime (task-041), not the contract.

## Implementation Notes

Landed in `packages/foundation/src/sim/{story,effect,input,context,system,exhaustive}.ts`.

- `System<State, Command, Effect, ViewModel>`: `Input` is *derived* as
  `Input<State, Command>` rather than a free type param, so the generic runtime
  can construct every inbound value and the algebra shape can't be bypassed.
- `Effect` carries a closed `family` discriminant with an open `kind`; `fx`
  builds the host-generic families (`present` is system-specific).
- Exhaustiveness proven by `sim/exhaustive.test.ts` via `@ts-expect-error` on a
  deliberately non-exhaustive switch.
