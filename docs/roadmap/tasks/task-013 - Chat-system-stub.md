---
id: task-013
title: Chat system stub
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
labels: [chat, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-011]
parent_task_id:
---

## Description

A minimal `systems/chat` that implements `System` with a trivial reducer — enough
to exercise the contract, not the physics (that is Phase 2). Defines a `ChatState`
slice and claims the chat tag vocabulary.

## Acceptance Criteria

- [ ] #1 `chatSystem` implements `System<ChatState, ChatViewModel>`
- [ ] #2 `ChatState` holds message/read/deferral fields; none of them leak into foundation types
- [ ] #3 It claims chat tags (speaker, type, time, targetChat, receipt, …) via `tags`
- [ ] #4 `reduce` turns a simple text chunk into one appended message and a `chat/showNotification` effect for a background target — no full physics
- [ ] #5 It imports only from foundation, never from another system

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #1, #4 — the stub implements `System`; `reduce` turns a text chunk into a message + a `chat/showNotification` effect for a background target
- constraint/compile (pre-commit): #2 — `ChatState` compiles without leaking into foundation types
- constraint/architecture (pre-commit): #3, #5 — claims its tags; imports only from foundation (boundary lint)

## Implementation Plan

`packages/systems/chat/src/index.ts`; throwaway reduce body, real types.

## Implementation Notes

Stub only — Phase 2 replaces the reducer with the headless physics kernel.
