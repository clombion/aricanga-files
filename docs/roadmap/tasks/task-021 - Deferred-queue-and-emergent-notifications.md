---
id: task-021
title: Deferred queue and emergent notifications
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, phase-2]
milestone: "Phase 2 — Chat simulation kernel (headless)"
dependencies: [task-020]
parent_task_id:
---

## Description

The deferred-message queue and emergent notifications: a background-chat message
defers and fires exactly one notification per chat until that chat is opened.

## Acceptance Criteria

- [ ] #1 A background message is appended to `deferredMessages[chatId]`
- [ ] #2 A `chat/showNotification` effect fires for the first background message of a chat, and not for subsequent ones until it is opened
- [ ] #3 No notification fires for seed messages or for the currently-viewed chat
- [ ] #4 Opening a chat clears its notified state and replays the deferred messages

## Tests

- **Classes:** behaviour
- behaviour/example (pre-commit): #1, #2, #3, #4 — cross-chat scenarios incl. notify-once and clear-on-open
- behaviour/property (CI): the notify-once and seed-exclusion invariants from task-018

## Implementation Plan

`packages/systems/chat/src/model/defer.ts`; `notifiedChatIds` set in the slice.

## Implementation Notes

_None yet._
