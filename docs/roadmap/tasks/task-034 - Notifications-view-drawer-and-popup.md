---
id: task-034
title: Notifications view (drawer + popup)
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, ui, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Lit)"
dependencies: [task-028, task-029]
parent_task_id:
---

## Description

View-only notification surfaces over the kernel's notification state: the drawer
(list) and the popup (toast). No notification state lives in the view — the kernel
is the single source of truth.

## Acceptance Criteria

- [ ] #1 Drawer and popup render from the view-model derived from kernel notification state — neither holds its own notification state
- [ ] #2 A popup tap emits an "open-chat" intent and a "dismiss" intent; auto-hide emits dismiss
- [ ] #3 Counts/badges derive from the same source — no duplicate counters
- [ ] #4 Keyboard-operable + axe-clean; the popup is announced to assistive tech (live region)

## Tests

- **Classes:** behaviour, non-functional
- behaviour/example (pre-commit): #1, #2, #3 — render-from-state, intents, single source for counts
- non-functional/a11y (PR): #4 — axe clean; live-region announcement; dismiss reachable by keyboard

## Implementation Plan

`packages/systems/chat/view/{notification-drawer,notification-popup}.ts`.

## Implementation Notes

_None yet._
