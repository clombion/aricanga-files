---
id: task-021
title: Deferred queue and emergent notifications
status: Done
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
- behaviour/property (CI): #6 — wire an explicit `notifyOnce` assertion (it is defined but run by no test today) over the `duplicate-notifications` regression fixture *and* a new in-chat defer fixture; `seedExclusion` stays green
- constraint/architecture (pre-commit): #6 — reducer purity; `routingOwnership` broadened but ownership-only. `chat-fixtures.test.ts` is verified-unaffected (its single-chat assertions key on family/kind + `every`, not a notification count, so 2→1 survives)

## Implementation Plan

- `ChatCommand = Command<'open',{chatId}> | Command<'close',undefined>`; narrow the
  system; `system.ts` handles `Player`.
- `model/defer.ts` (pure): branch order is **immediate-flush first**, then defer, then
  history+maybe-notify — `# immediate` (detected via `step.tags.some(t => t.key ===
  'immediate')`) is checked *ahead* of the defer gate, else an in-another-chat
  already-notified immediate would wrongly defer; `inAnotherChat && alreadyNotified →
  defer`, else append to history + (`!isViewed && !alreadyNotified` → notify + mark).
  `appendDeferred`, `openChat` (clear-notified + single-shot replay that **moves the
  stored VMs** — they keep their defer-time ids, no `ctx.nextId()` on replay).
  `notifiedChatIds` is a `string[]` — array ops, not Set.
- `chat/src/testing/predicates.ts`: broaden `routingOwnership` to accept
  `deferredMessages[target]` (ownership-only; defer-correctness via examples). Required
  for the new in-chat defer assertions (existing hub-only tests don't defer, so they
  stay green either way).
- `defer.test.ts` — `Player`-open-driven examples (no existing fixture is in a chat).
- Forward note for task-022: the unread separator is derived in the view from
  `notifiedChatIds.has(chatId)` *before* `open` clears it — 022's separator must read
  a flag that survives this delete, not `notifiedChatIds` post-open.

## Implementation Notes

- `model/defer.ts` (pure): `placeMessage` — immediate-flush first, then
  `inAnotherChat && alreadyNotified → defer`, else history + (`!isViewed &&
  !alreadyNotified` → notify+mark). `openChat` (focus + clear-notified + single-shot
  replay that moves the stored VMs, ids preserved) / `closeChat` (→ hub). `# immediate`
  detected via the tag array; `notifiedChatIds` as `string[]` ops.
- `ChatCommand = open{chatId} | close`; the system narrows to it and handles `Player`.
- `routingOwnership` broadened to `messageHistory ∪ deferredMessages` (ownership-only).
- `defer.test.ts` (5 `Player(open)`-driven examples: notify-once, in-chat defer,
  open-replay-in-order, viewed-chat no-notify, `# immediate` flush). `notifyOnce`
  wired green here and over the `duplicate-notifications` regression (it ran in no
  test before). `chat-fixtures` survived the 2→1 notification change unchanged.
- Zero foundation changes. Verified: `tsc -b`, `lint`, `test:rebuild` (47), `vite build`.
  notify-once + seed-exclusion green; routing/determinism/purity green.
