---
id: task-035
title: systems/phone — status bar, home indicator, connection overlay
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [phone, ui, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Lit)"
dependencies: [task-028, task-029]
parent_task_id:
---

## Description

Extract the phone chrome into `systems/phone`: status bar (time/battery/signal),
home indicator, and the connection-instability overlay — pure components over a
phone view-model. This is the chat↔phone split (TASK-141) made real.

## Acceptance Criteria

- [ ] #1 `systems/phone` exists and imports only foundation (boundary lint passes; no import from `systems/chat`)
- [ ] #2 The status bar renders time/battery/signal from the phone view-model
- [ ] #3 Home indicator and connection overlay render from view-model flags
- [ ] #4 Components hold no domain state; axe-clean

## Tests

- **Classes:** behaviour, non-functional, constraint
- behaviour/example (pre-commit): #2, #3 — status bar + overlay render from VM
- constraint/architecture (pre-commit): #1 — boundary lint: phone imports no chat
- non-functional/a11y (PR): #4 — axe clean; status conveyed non-visually where meaningful

## Implementation Plan

`packages/systems/phone/view/*`.

## Implementation Notes

_None yet._
