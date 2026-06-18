---
id: task-020
title: Message routing and targetChat
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, phase-2]
milestone: "Phase 2 — Chat simulation kernel (headless)"
dependencies: [task-017, task-018]
parent_task_id:
---

## Description

Implement routing in the pure reducer: `current_chat`, the `# targetChat`
override, and the routing decision tree (emit immediately vs defer, by current
view). First implementation slice turning task-018 from red toward green.

## Acceptance Criteria

- [ ] #1 A message routes to `current_chat` by default and to `# targetChat` when present (tag read before the variable resets)
- [ ] #2 A message for the viewed chat emits immediately; for a background chat it defers
- [ ] #3 Each message is tagged with its owning chat at creation
- [ ] #4 Routing is pure — no DOM; effects returned as data

## Tests

- **Classes:** behaviour
- behaviour/example (pre-commit): #1, #2, #3 — default routing, `targetChat` override, viewed vs background
- behaviour/property (CI): satisfies the routing-ownership invariants from task-018

## Implementation Plan

`packages/systems/chat/src/model/route.ts`; pure, over `StoryChunk`.

## Implementation Notes

_None yet._
