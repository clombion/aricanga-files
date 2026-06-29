---
id: task-020
title: Message routing and targetChat
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-28
labels: [chat, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-017, task-018]
parent_task_id:
---

## Description

The first physics slice: implement routing in the pure chat reducer. Default
routing follows the conversation context (`activeChat`, set by a `# chat:` tag at
knot entry and tracked in chat state); a `# targetChat` tag overrides it. Each
routed message lands in its owning chat's `messageHistory` and is stamped with a
stable id and its owning `chatId`. Routing stays a pure reducer decision — no
foundation change (the signal is a chat tag, consistent with the foundation
tag-router), so foundation stays vocabulary-agnostic. Deferral, notify-once, and
replay are task-021.

## Acceptance Criteria

- [ ] #1 A `# chat:` tag updates the chat's `activeChat`; a message routes to `# targetChat` when present, else `activeChat`, else the `'main'` default — entirely in the pure reducer
- [ ] #2 Every routed message is appended to its owning chat's `messageHistory`; routing is independent of the current view (the emit-vs-defer / notify-once refinement is task-021); a background-chat message keeps the basic notification carried over from the stub
- [ ] #3 Each message carries a stable id (`ctx.nextId`) and its owning `chatId`, assembled at creation
- [ ] #4 Routing is pure — no DOM and no foundation change; effects returned as data
- [ ] #5 `routingOwnership` and the cross-chat regression fixture stay green; determinism and the purity lint hold; notify-once stays red (task-021's job)

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #1, #2, #3 — `activeChat` default routing, `# targetChat` override, owning-chat + id identity
- behaviour/property (CI): #5 — the routing-ownership invariant from task-018 over generated streams that include the `chat`/`targetChat` tags
- constraint/architecture (pre-commit): #4 — no foundation change; the reducer is pure (purity lint)

## Implementation Plan

- `packages/systems/chat/src/model/route.ts` (new) — pure routing
  (`targetChat ?? activeChat ?? 'main'`) + `ChatMessageVM` assembly
  (`{ id: ctx.nextId(), chatId, ...reduceStep(step) }`).
- `state.ts` — add `activeChat` to `ChatState`; `ChatMessageVM` gains `id` + `chatId`.
- `system.ts` — add `'chat'` to `CHAT_TAGS`; `reduce` updates `activeChat` on a
  `# chat:` tag and delegates routing to `model/route.ts`. `reduceStep` stays the
  `{speaker,text}` mapper (sandbox + `reduce.test.ts` unaffected).
- Routing property test: include the `chat` tag in the generator's `tagKeys`.
- Note for task-021: broaden `routingOwnership` to also accept `deferredMessages[target]`
  once 021 routes background messages to the queue.

## Implementation Notes

- D1 = tag-based routing (Option B): zero foundation change. `# chat:` (added to
  `CHAT_TAGS`) sets `ChatState.activeChat`; routing is `targetChat ?? activeChat ??
  'main'`. Foundation stays vocabulary-agnostic.
- `model/route.ts` (pure): `readChatSwitch`, `resolveChatId`, `buildMessage`
  (`{ id: ctx.nextId(), chatId, ...reduceStep(step) }`), `appendMessage`. `reduceStep`
  stays the `{speaker,text}` mapper, so `reduce.test.ts` + the sandbox are unaffected.
- Seam with 021: 020 routes **every** message into `messageHistory` and never touches
  `deferredMessages`; the reducer keeps the basic per-message notification, so
  `notifyOnce` stays red until 021 adds dedup + the deferred queue. (POC fidelity: the
  first background message goes to history + notifies; only already-notified ones defer.)
- Forward note for 021: broaden `routingOwnership` to also accept `deferredMessages[target]`
  once background messages are deferred, so the invariant doesn't break.
- Verified: `tsc -b`, `lint` (purity over `model/route.ts`), `test:rebuild` (41), `vite build`.
