---
id: task-033
title: chat-hub
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

The conversation list: per-chat preview, unread badges, and the "Now" preview
override for background-chat messages.

## Acceptance Criteria

- [ ] #1 The hub renders one row per chat with the latest preview ("You:" prefix + receipt for sent) from the view-model
- [ ] #2 Unread badges reflect kernel unread state; clearing on open is driven by the view-model, not local state
- [ ] #3 The "Now" preview override applies for background-chat messages and reverts on the documented triggers
- [ ] #4 A row emits an "open-chat" intent; holds no domain state; keyboard-operable + axe-clean

## Tests

- **Classes:** behaviour, non-functional
- behaviour/example (pre-commit): #1, #2, #3 — preview format, badge counts, Now override
- non-functional/a11y (PR): #4 — axe clean; list navigable; rows are buttons/links with accessible names

## Implementation Plan

`packages/systems/chat/view/chat-hub.ts`.

## Implementation Notes

_None yet._
