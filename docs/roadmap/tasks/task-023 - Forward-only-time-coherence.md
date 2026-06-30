---
id: task-023
title: Forward-only time coherence
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-30
labels: [chat, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-017, task-018]
parent_task_id:
---

## Description

Simulation time in the kernel as a pure absolute-minutes clock
(`day*1440 + minuteOfDay`, no wall clock): `advance_day`, `# time:` snap,
`# duration:N` jump, and auto-drift, with the forward-only rule that prevents
cross-chat paradoxes. Each message is stamped with its clock; a `chat/timeChanged`
effect carries the new absolute. Turns task-018's `forwardOnlyTime` green.

Per Story message the clock advances in this order (POC fidelity):
1. `advance_day` (from `InkStep.externalCalls`) — **first** — day += 1, reset to 09:00.
2. `# time:HH:MM [AM|PM]` snap — forward-only (reject backward, clock unchanged).
3. `# duration:N` jump — += N.
4. auto-drift — += 1, **only once the clock is initialized** by the first `# time:` tag.
Then the message is stamped and `chat/timeChanged` emitted only if the clock changed.

## Acceptance Criteria

- [ ] #1 The advance order holds: `advance_day` first (→ next day 09:00), then `# time:` snap / `# duration:N` jump / auto-drift +1; drift applies only once a `# time:` tag has initialized the clock (plain messages before the first time tag stamp the start clock)
- [ ] #2 Time never goes backward — a backward `# time:` snap is rejected and the clock is unchanged
- [ ] #3 Seed messages display a time but do not advance the clock (structural: seeds arrive via `Lifecycle(Init)`, not the `Story` path — fully exercised in task-025)
- [ ] #4 Pure: the clock is absolute minutes (no `Date`/wall clock); each message is stamped with its simulation time; identical inputs ⇒ identical clock; `chat/timeChanged` is emitted only when the clock changes
- [ ] #5 `forwardOnlyTime` is green — the property proves drift-monotonicity over generated streams (with a custom time-string arbitrary); examples cover snap / backward-reject / duration / advance_day / ordering / AM-PM edges

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #1, #2 — each time op, advance_day-first ordering, backward-reject, AM/PM (`12 AM`→0, `12 PM`→12), malformed tag → drift
- behaviour/property (CI): #4, #5 — `forwardOnlyTime` monotonic over generated time-tag streams (task-018; honestly drift-level, snaps covered by examples)
- constraint/architecture (pre-commit): #4 — purity lint (no `Date` in the clock reducer)

## Implementation Plan

- `state.ts` — add `clock: number` (init = day-1 09:00 = `1*1440+540`) and `timeInitialized: boolean`.
- `reduce.ts` — `ChatMessageVM` gains `time: number` (frozen sim timestamp; view formats it).
- `model/time.ts` (new, pure) — `parseTimeOfDay` (regex `^(\d{1,2}):(\d{2})\s*(AM|PM)?$` + int math, no `Date`, AM/PM rules); `advanceTime(state, step) → { clock, timeInitialized, changed }` applying advance_day → snap → duration → drift(gated).
- `model/route.ts` — `buildMessage` takes + stamps `time` (at build, so deferred messages keep their arrival time).
- `system.ts` — the `Story` path: `advanceTime`, stamp the message, prepend a `chat/timeChanged` effect (only when `changed`) to `placeMessage`'s effects.
- `ChatViewModel` — expose `clock` (the view formats day/time-of-day via `RenderContext.locale`).
- generators — a small time-string arbitrary; `time.test.ts` examples + the `forwardOnlyTime` property.

Day-crossing happens ONLY via `advance_day`; the absolute model agrees with the POC's
time-of-day snap on every same-day comparison. Seam note for task-025: seeds must route
off the `Story` path (via `Lifecycle(Init)`), else 023 would drift on them.

## Implementation Notes

_None yet._
