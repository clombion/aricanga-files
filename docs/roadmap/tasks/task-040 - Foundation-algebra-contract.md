---
id: task-040
title: Foundation algebra contract
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [foundation, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: []
parent_task_id:
---

## Description

Define the foundation's closed `Input`/`Effect` algebra and the pure-reducer `System` contract (ADR-0007). This is the generic framework every system implements; chat and cards are instances. See `phase-1-foundation-design.md`.

## Acceptance Criteria

- [ ] #1 `Input` is a discriminated union `Story | Player | Resume | Lifecycle`; `InkStep = {text, tags, choices, externalCalls, status}`; `Command`/`Effect` are open `{kind, payload}` envelopes
- [ ] #2 `System` exposes `reduce(state, input, ctx)`, `status(state)`, `view(state, render)`, `init(seed)`; `reduce`/`view`/`status` are typed pure (readonly inputs, no `void` side-effect returns)
- [ ] #3 `ReduceContext` is `{ nextId(): string }` only — no clock; `RenderContext` is `{ now, locale }`
- [ ] #4 An `assertNever` exhaustiveness helper exists; handling `Input`/`Effect` non-exhaustively fails to compile
- [ ] #5 The chat stub, cards stub, and the two-vocabulary proof compile against the new contract; foundation references no system type

## Tests

- **Classes:** constraint
- constraint/compile (pre-commit): #1, #2, #3, #5 — types total; stubs conform; no `any` in the public surface
- constraint/compile (pre-commit): #4 — a deliberately non-exhaustive `Input` switch fails to compile (`never` check)

## Implementation Plan

`packages/foundation/src/sim/{input,effect,system,context}.ts`; replace `reduce(chunk)` with `reduce(input)`; add `status`; `assertNever` util.

## Implementation Notes

_None yet._
