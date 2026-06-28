---
id: task-041
title: Generic Sans-IO host runtime
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-28
labels: [foundation, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-040]
parent_task_id:
---

## Description

The system-agnostic runtime that drives any `System`: it owns all impure resources (ink Story, clock, storage, timers, id allocation), pumps the system while ready, executes effects, and feeds resume inputs back (ADR-0007). Reused unchanged by chat and cards. The runtime owns the generic primitives — the pump gate, the effect executor, the commit token, and the id allocator — while vocabulary-specific policy (e.g. chat's buffer-generation semantics) lives in the systems.

## Acceptance Criteria

- [ ] #1 The runtime pumps the next ink step only when `status(state)` is `free` and ink can continue; it suspends on `busy-commit`/`busy-data`, on choices (awaits `Player(Choose)`), and on idle (awaits `Player`/`Lifecycle`)
- [ ] #2 An effect executor maps `kind → handler`; an unknown kind is a typed error; every suspending effect (`Schedule`, `Fetch`, `Lifecycle` load/restore) has exactly one matching `Resume` input — the handshake table is total
- [ ] #3 The runtime owns a deterministic **commit-token** primitive: while a `Schedule(Commit tok)` is in flight no step is pumped; `Schedule(Commit tok)` resolves to exactly one `Resume(CommitFired tok)`; a stale token is a no-op. (When to mint a commit — chat's `bufferGeneration` bump policy — belongs to the chat physics, not here.)
- [ ] #4 The runtime owns a deterministic **monotonic id allocator**: it seeds `ctx.nextId` for each `reduce`, advances by the ids consumed, and persists the position as `idSeq` in the host snapshot envelope — so ids never collide across restore and `reduce` is referentially transparent given `(state, input, ctx)`
- [ ] #5 Player `Open`/`Close` are validated host-side against config and fail loud on an unknown target; the kernel trusts validated input
- [ ] #6 Ink is host-owned: the runtime owns the `Story` and per-conversation snapshots (`ToJson`/`LoadJson`) and drains the ink side-channel into `InkStep` per the task-040 external contract (`name`/`data` → text; `delay_next`/`play_sound`/`advance_day`/`request_data` → `externalCalls`; `request_data` → `await-data`); the kernel never reads ink
- [ ] #7 The runtime drives chat, cards, and a synthetic harness system unchanged; the harness reports each `status` and emits one effect of each family, so the gate/resume/unknown-kind paths are exercisable independent of any vocabulary

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #1, #2 — pump/suspend transitions over the harness; effect→resume round-trips; unknown-kind throws
- behaviour/example (pre-commit): #3 — commit token: in-flight blocks the pump; `CommitFired` resumes; a stale token is a no-op
- behaviour/example (pre-commit): #4 — allocate id → snapshot → restore → next id does not collide; a run-twice replay is deep-equal
- behaviour/example (pre-commit): #5 — open with an unknown chat id throws
- constraint/architecture (pre-commit): #6, #7 — no ink/clock access in any reducer; the runtime imports no system type

## Implementation Plan

`packages/foundation/src/host/runtime.ts` (loop + executor + commit token + id allocator) over the task-040 contract; the ink wrapper owns the `Story` and drains externals; `packages/foundation/test/harness-system.ts` is the synthetic driver fixture.

## Implementation Notes

_None yet._
