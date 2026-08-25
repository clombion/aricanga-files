---
id: task-023
title: Forward-only time coherence
status: Done
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
cross-chat paradoxes. The clock is **state** (`clock: number | null`, null =
unanchored) — a monotonic state cursor like the HWM read cursor, not an effect;
`forwardOnlyTime` reads `state.clock`. Each message is stamped with its clock.

Per Story step the clock advances in this order:
1. `advance_day` (from `InkStep.externalCalls`) — **first**, even on a text-empty
   line — → next day, reset to 09:00.
2. `# time:HH:MM [AM|PM]` snap — establish if unanchored, else forward-only (a
   backward snap is rejected, clock unchanged).
3. `# duration:N` jump — += N (only when anchored).
4. auto-drift — += 1 (only when anchored).

## Acceptance Criteria

- [x] #1 The advance order holds: `advance_day` first (→ next day 09:00), then `# time:` snap / `# duration:N` jump / auto-drift +1
- [x] #2 Time never goes backward — a backward `# time:` snap is rejected and the clock is unchanged (forward-only by construction)
- [x] #3 An unanchored clock (`null`) is a shape, not a guard: drift/duration are inert until a time signal anchors it, and a message arriving pre-anchor stamps `null` (view renders a date separator). Seeds arrive via `Lifecycle(Init)`, not the `Story` path (fully exercised in task-025)
- [x] #4 Pure: absolute-minutes clock, no `Date`/wall clock (purity lint); identical inputs ⇒ identical clock; time is **state**, so `forwardOnlyTime` reads `state.clock` (no `chat/timeChanged` effect — a redundant mirror that could drift from the clock)
- [x] #5 `forwardOnlyTime` is green — the property (custom time-string arbitrary that anchors the clock) is non-vacuous; examples cover snap establish/backward-reject / duration / advance_day-first ordering / drift-when-anchored / AM-PM edges / malformed→drift

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #1, #2, #3 — each time op, advance_day-first, backward-reject, pre-anchor null, AM/PM + malformed
- behaviour/property (CI): #4, #5 — `forwardOnlyTime` over generated time-tag streams (anchored → non-vacuous)
- constraint/architecture (pre-commit): #4 — purity lint (no `Date` in `model/time.ts`)

## Implementation Plan

- `state.ts` — `clock: number | null` (init `null`); `reduce.ts` — `ChatMessageVM.time:
  number | null`.
- `model/time.ts` (pure) — `parseTimeOfDay` (regex + int math, no `Date`, AM/PM);
  `advanceTime(state, step)` (advance_day first → snap establish/forward-only →
  duration → drift, all gated on non-null; same-ref when unchanged).
- `model/route.ts` — `buildMessage(step, chatId, ctx, time)` stamps the clock.
- `system.ts` — Story path: `advanceTime` before the empty-text return (so
  advance_day fires on text-empty lines), stamp the message; no time effect.
- `predicates.ts` — `forwardOnlyTime` reads `state.clock` non-decreasing over the
  trace (skip null), parallel to `hwmMonotonic`.

Design rationale (why not the POC's boolean + per-message effect) is in the approved
plan: the `| null` shape makes the "unanchored" mode total and removes an arbitrary
9:00 floor; the clock is state, so an effect copy is a redundant mirror.

## Implementation Notes

- `clock: number | null`; no `timeInitialized` boolean (the `| null` shape is the
  distinction). No `chat/timeChanged` effect — `forwardOnlyTime` reads `state.clock`
  (5th predicate green, state-based like `hwmMonotonic`). ADR-0007 needed no edit (it
  never listed `TimeChanged` under Present).
- `advance_day` runs before the text-empty early return; the malformed-tag path falls
  through to drift. `parseTimeOfDay` rejects `13:00 PM` / `9:99` and handles
  `12 AM`→0 / `12 PM`→12 / 24h.
- Verified: `tsc -b`, `lint` (purity), `test:rebuild` (59), `vite build`. Seam note
  for task-025: seeds must route off the `Story` path or 023 would drift on them.
