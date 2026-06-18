---
id: task-032
title: Receipts, typing indicator, and choice buttons
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, ui, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Lit)"
dependencies: [task-030]
parent_task_id:
---

## Description

The thread's dynamic affordances: read-receipt glyphs on sent bubbles, the
animated typing indicator, and choice buttons that emit a choice intent.

## Acceptance Criteria

- [ ] #1 The receipt glyph (sent/delivered/read) renders from the message view-model per the documented visual spec
- [ ] #2 The typing indicator shows/hides from a view-model flag (driven by a `chat/startTyping` effect), with reduced-motion support
- [ ] #3 Choice buttons render the current choices and emit a "choice-selected" intent carrying the choice index
- [ ] #4 All three hold no domain state; keyboard-operable + axe-clean

## Tests

- **Classes:** behaviour, non-functional
- behaviour/example (pre-commit): #1, #2, #3 — receipt states, typing show/hide, choice intent payload
- non-functional/a11y (PR): #4 — axe clean; choices reachable + activatable by keyboard; reduced-motion honoured

## Implementation Plan

`packages/systems/chat/view/{typing-indicator,choice-buttons,receipt}.ts`.

## Implementation Notes

_None yet._
