---
id: task-022
title: HWM read cursors and unread separator
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, phase-2]
milestone: "Phase 2 — Chat simulation kernel (headless)"
dependencies: [task-021]
parent_task_id:
---

## Description

High-water-mark read state: per-chat `lastReadMessageId`, the cursor-update rules,
and unread-separator placement.

## Acceptance Criteria

- [ ] #1 `lastReadMessageId` updates on chat close and on chat-to-chat / hub navigation, but not on initial open or on receiving while viewing
- [ ] #2 Opening a notified chat places the unread separator after `lastReadMessageId`
- [ ] #3 Edge cases hold: null cursor → no separator; all-new → separator at top; `# immediate` → no separator
- [ ] #4 Computed purely as derived data

## Tests

- **Classes:** behaviour
- behaviour/example (pre-commit): #1, #2, #3 — cursor-update rules and separator edge cases
- behaviour/property (CI): the HWM-correctness invariant from task-018

## Implementation Plan

`packages/systems/chat/src/model/read-state.ts`.

## Implementation Notes

_None yet._
