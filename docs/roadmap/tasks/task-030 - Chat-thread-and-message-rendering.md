---
id: task-030
title: chat-thread and message rendering
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

The thread container and text-message rendering: message list, grouping render,
date and unread separators, and the display-only "Now" timestamp override.

## Acceptance Criteria

- [ ] #1 The thread renders messages from the view-model with grouping (spacing/radius) per the task-026 derivation
- [ ] #2 Date separators and the unread separator render at the correct positions
- [ ] #3 The "Now" override displays for a fresh message without mutating `msg.time`, and reverts on the documented triggers
- [ ] #4 The component holds no domain state and emits a scroll/visible intent rather than tracking read state itself
- [ ] #5 Keyboard-operable and axe-clean

## Tests

- **Classes:** behaviour, non-functional
- behaviour/example (pre-commit): #1, #2, #3 — grouping, separators, Now override + revert
- behaviour/snapshot (pre-commit): #1 — golden rendered thread for a fixture VM
- non-functional/a11y (PR): #5 — axe clean; keyboard navigation through messages

## Implementation Plan

`packages/systems/chat/view/chat-thread.ts` (Lit), pure over the thread VM.

## Implementation Notes

_None yet._
