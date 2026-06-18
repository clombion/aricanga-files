---
id: task-036
title: Lock screen and battery context
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [phone, ui, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Lit)"
dependencies: [task-035]
parent_task_id:
---

## Description

The lock-screen overlay with its notifications, wake/unlock interaction, and the
battery context as a phone-system service feeding the status bar.

## Acceptance Criteria

- [ ] #1 The lock screen renders notifications (view-only) from kernel state and emits an "unlock" intent
- [ ] #2 Wake/unlock transitions are driven by intents/effects, not local domain state
- [ ] #3 Battery context lives in `systems/phone`, drains via the injected clock, and emits a battery view-model value (no global singleton)
- [ ] #4 Keyboard-operable + axe-clean; respects reduced-motion for particle/wake animation

## Tests

- **Classes:** behaviour, non-functional
- behaviour/example (pre-commit): #1, #2, #3 — lock notifications, unlock intent, battery drain over a fake clock
- non-functional/a11y (PR): #4 — axe clean; unlock operable by keyboard; reduced-motion honoured

## Implementation Plan

`packages/systems/phone/view/lock-screen.ts` + `packages/systems/phone/battery.ts`.

## Implementation Notes

_None yet._
