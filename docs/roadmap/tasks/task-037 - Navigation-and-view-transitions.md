---
id: task-037
title: Navigation and view transitions
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [ui, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Lit)"
dependencies: [task-030, task-033]
parent_task_id:
---

## Description

Wire navigation and animated transitions through intents: hub↔thread open/close,
the choice-selection flow, and motion-level view transitions — all driven by the
host loop, with `currentView` the single source of truth.

## Acceptance Criteria

- [ ] #1 "open-chat"/"close-chat" intents drive `currentView` in the kernel; the view re-renders from snapshot (no local nav state)
- [ ] #2 Choice selection advances the kernel and the thread updates from the new snapshot
- [ ] #3 View transitions (hub↔thread) honour the motion level and reduced-motion
- [ ] #4 Focus moves correctly on navigation (focus management/trap), verified by test

## Tests

- **Classes:** behaviour, non-functional
- behaviour/example (pre-commit): #1, #2 — nav intents drive `currentView`; choice advances the snapshot
- behaviour/example (pre-commit): #3 — transition respects the motion level
- non-functional/a11y (PR): #4 — focus lands correctly; no focus loss on navigation

## Implementation Plan

Host-level navigation reducer + `packages/ui/transitions.ts`.

## Implementation Notes

_None yet._
