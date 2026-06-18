---
id: task-023
title: Forward-only time coherence
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, phase-2]
milestone: "Phase 2 — Chat simulation kernel (headless)"
dependencies: [task-017, task-018]
parent_task_id:
---

## Description

The time physics in the kernel: auto-drift, `# time:` / `# duration:` tags,
`advance_day`, and the forward-only rule that prevents cross-chat paradoxes.

## Acceptance Criteria

- [ ] #1 Auto-drift +1 min per message; `# time:` hard-snaps; `# duration:N` advances N; `advance_day` moves to the next day
- [ ] #2 Time never goes backward — a backward `# time:` is rejected and the clock is unchanged
- [ ] #3 Seed messages display a time but do not advance the clock
- [ ] #4 Time is injected (no `Date.now()`); identical inputs ⇒ identical clock

## Tests

- **Classes:** behaviour
- behaviour/example (pre-commit): #1, #3 — each time operation and the seed exclusion
- behaviour/property (CI): #2, #4 — forward-only monotonicity over generated time-tag sequences (task-018)

## Implementation Plan

`packages/systems/chat/src/model/time.ts`; pure clock reducer.

## Implementation Notes

_None yet._
