---
id: task-041
title: Generic Sans-IO host runtime
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [foundation, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-040]
parent_task_id:
---

## Description

The system-agnostic runtime that drives any `System`: it owns all impure resources (ink Story, clock, storage, timers), pumps the system while ready, executes effects, and feeds resume inputs back (ADR-0007). Reused unchanged by chat and cards.

## Acceptance Criteria

- [ ] #1 The runtime pumps the next ink chunk only when `status(state)` is `free` and ink can continue; it suspends on `busy-commit`/`busy-data`, on choices (awaits `Player(Choose)`), and on idle
- [ ] #2 An effect executor maps `kind → handler`; an unknown kind is a typed error; every suspending effect (`Schedule`, `Fetch`, lifecycle load) has exactly one matching `Resume` input
- [ ] #3 No chunk is pumped while a `Schedule(Commit)` is in flight; `bufferGeneration` is bumped only by view-change commands; a chaining commit reuses the epoch; a stale `commit{epoch}` is a no-op
- [ ] #4 Player `Open`/`Close` are validated host-side against config and fail loud on an unknown target; the kernel trusts validated input
- [ ] #5 Ink is host-owned (Story, per-conversation snapshots, `ToJson`/`LoadJson`, side-channel drain); the kernel never reads ink
- [ ] #6 The runtime drives both the chat and cards systems unchanged

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #1, #2 — pump/suspend transitions; effect→resume round-trips; unknown-kind throws
- behaviour/example (pre-commit): #3 — commit epoch interleavings (chain vs preempting open) are deterministic
- behaviour/example (pre-commit): #4 — open with unknown chat id throws
- constraint/architecture (pre-commit): #5, #6 — no ink/clock access in any reducer; runtime imports no system type

## Implementation Plan

`packages/foundation/src/host/runtime.ts` (loop + executor) over the task-040 contract; ink wrapper owns the Story.

## Implementation Notes

_None yet._
