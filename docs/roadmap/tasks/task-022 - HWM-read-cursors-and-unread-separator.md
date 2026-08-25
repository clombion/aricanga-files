---
id: task-022
title: HWM read cursors and unread separator
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-30
labels: [chat, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-021]
parent_task_id:
---

## Description

High-water-mark read state: the per-chat read cursor `lastReadMessageId`, its
update rules, and the unread-separator anchor. The cursor *is* the separator
anchor (POC fidelity) — set at the first notification of a chat and advanced when
you leave it — so the separator is pure derived data with no extra state field and
no 021 seam. Turns task-018's `hwmMonotonic` green.

## Acceptance Criteria

- [ ] #1 `lastReadMessageId[C]` advances to C's last message id when you **leave** C — on close, and on chat-to-chat navigation away from C — but not on initial open and not on receiving while viewing
- [ ] #2 The cursor doubles as the separator anchor: on the **first notification** of a chat, if the cursor is unset, it is set to the chat's last message id *before* the arriving message (or `null` = before-all if the chat was empty); an existing cursor is preserved
- [ ] #3 Edge encoding holds: absent entry → no separator; `null` → separator at top (before-all); an id → separator after that id; a `# immediate` flush into an already-notified chat sets no new anchor. This encoding is the binding contract — it deliberately replaces the POC's `'__BEFORE_ALL__'` string sentinel with `null`, so the Phase-3 renderer keys off *this* mapping (`null`⇒top), not the POC's (`null`⇒no-separator)
- [ ] #4 The separator is computed purely as derived data — the view exposes the cursor and placement is derived from `lastReadMessageId` + `messageHistory`; no stored separator field, no imperative insertion
- [ ] #5 `hwmMonotonic` is green and **meaningfully exercised** — the leave-advance is covered by an explicit `notify → open → leave` *example* (the story-only property generator drives the anchor-set but not the leave-rule), the weak form (the cursor never un-reads; forward-advance strengthening is deferred)

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #1, #2, #3 — leave-advances-cursor (close + nav), anchor-at-notify, the absent/null/id edge encoding
- behaviour/property (CI): #5 — `hwmMonotonic` over a stream that drives the cursor non-null (honestly the weak "no un-reading" form)
- constraint/architecture (pre-commit): #4 — no new state field; reducer purity

## Implementation Plan

- `model/defer.ts` — in `placeMessage`'s notify branch (`!isViewed && !alreadyNotified`),
  set `lastReadMessageId[chatId]` **if absent** to the **pre-append** last id —
  `const prior = state.messageHistory[chatId] ?? []` (read from `state`, NOT `next`,
  which already holds the new message — an off-by-one that would put the separator
  *after* the new message), `prior.length ? prior.at(-1).id : null`. (The anchor-set
  lives here — it's part of the notify physics — which avoids a `defer ↔ read-state`
  import cycle.)
- `model/read-state.ts` (new, pure): `markRead(state, chatId)` (cursor → C's last id;
  **no-op when C is empty** — never write `null` on leave, else an empty-chat-leave
  would read as before-all/top under this encoding);
  the open/close orchestration over 021's `openChat`/`closeChat` — `open Y`:
  `markRead(prev)` when in a different chat, then `openChat`; `close`: `markRead(current)`,
  then `closeChat`.
- `system.ts` — the open/close handlers call the read-state orchestration.
- `ChatViewModel` — expose `lastReadMessageId` (placement is Phase 3 `chat-thread`).
- `read-state.test.ts` — cursor triggers, anchor-at-notify, edge encoding; assert
  `hwmMonotonic` green over a real cursor-exercising stream.

The cursor uses the existing `Record<string, string | null>` shape: `absent` = no
separator, `null` = before-all (top), `id` = after-id. No new field; `hwmMonotonic`
stays green and meaningful (an `id → null` regression still trips it).

## Implementation Notes

- Cursor-as-anchor, no new state field. `model/defer.ts` `placeMessage` notify branch
  sets `lastReadMessageId[chatId]` if absent to the **pre-append** last id (read from
  `state`, not `next`) or `null` (before-all) for an empty chat; an existing cursor is
  preserved.
- `model/read-state.ts`: `markRead` (cursor → C's last id; **no-op on empty** — never
  writes `null` on leave); `openWithReadState` (markRead prev on chat-to-chat nav, then
  021's `openChat`) / `closeWithReadState` (markRead current, then `closeChat`). The
  system's open/close handlers call these. No `defer ↔ read-state` cycle.
- `ChatViewModel` exposes `lastRead`; the `<unread-separator>` placement is Phase 3,
  keyed off this encoding (absent=none, null=top, id=after) — replacing the POC's
  `'__BEFORE_ALL__'` sentinel.
- `read-state.test.ts` (6): close/nav cursor advance, no-write-on-open/receive,
  before-all anchor, set-cursor preservation, and `hwmMonotonic` green over a real
  notify→open→leave stream (non-vacuous; the weak no-un-reading form).
- Zero foundation changes. Verified: `tsc -b`, `lint`, `test:rebuild` (53), `vite build`.
