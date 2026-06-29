---
id: task-021
title: Deferred queue and emergent notifications
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-28
labels: [chat, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-020]
parent_task_id:
---

## Description

Complete the emergent-notification and deferred-queue physics 020 left out: a
message the player isn't viewing notifies exactly once per chat per epoch,
already-notified messages for a *different open chat* defer, and opening a chat
clears its notified state and replays its deferred queue into history. Introduces
the `Player(open/close)` lifecycle and `# immediate`. Turns task-018's `notifyOnce`
green and keeps `seedExclusion` green; broadens `routingOwnership` so deferral
doesn't break it.

The defer gate is *being inside a different chat* — at the hub messages flow to
history normally and never defer (POC fidelity); deferral is only for messages
arriving in a chat you've been notified about but haven't opened.

## Acceptance Criteria

- [ ] #1 The notify/defer branch is correct: at the hub and for the viewed chat a message lands in `messageHistory`; only a message for a *different open chat* that is already-notified defers to `deferredMessages[chatId]`
- [ ] #2 `chat/showNotification` fires for the first message of a chat the player isn't viewing, and not for subsequent ones until that chat is opened (notify-once via `notifiedChatIds`)
- [ ] #3 No notification fires for the currently-viewed chat (live now), nor for seed messages (structural; becomes live in task-025)
- [ ] #4 `Player(open chatId)` sets the view, clears the chat's notified state, and replays its deferred queue into `messageHistory` in one shot (order + ids preserved, no notification on replay); `Player(close)` returns to the hub
- [ ] #5 A `# immediate` message bypasses deferral (always to `messageHistory`) and flushes any already-deferred messages for that chat into history
- [ ] #6 `notifyOnce` is green; `seedExclusion` stays green; `routingOwnership` (broadened to `messageHistory ∪ deferredMessages`) stays green; determinism and purity hold

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #1–#5 — driven by `Player(open/close)`: in-chat defer + single-shot replay, notify-once, viewed-chat no-notify, `# immediate` flush
- behaviour/property (CI): #6 — the notify-once + seed-exclusion invariants from task-018 (now green)
- constraint/architecture (pre-commit): #6 — reducer purity; `routingOwnership` broadened but ownership-only

## Implementation Plan

- `ChatCommand = Command<'open',{chatId}> | Command<'close',undefined>`; narrow the
  system; `system.ts` handles `Player`.
- `model/defer.ts` (pure): the four-way notify/defer branch
  (`inAnotherChat && alreadyNotified → defer`, else history + maybe notify+mark),
  `appendDeferred`, `openChat` (clear-notified + single-shot replay), the
  `# immediate` flush. `notifiedChatIds` is a `string[]` — array ops, not Set.
- `chat/src/testing/predicates.ts`: broaden `routingOwnership` to accept
  `deferredMessages[target]` (ownership-only; defer-correctness via examples).
- `defer.test.ts` — `Player`-open-driven examples (no existing fixture is in a chat).
- Forward note for task-022: the unread separator is derived in the view from
  `notifiedChatIds.has(chatId)` *before* `open` clears it — 022's separator must read
  a flag that survives this delete, not `notifiedChatIds` post-open.

## Implementation Notes

_None yet._
