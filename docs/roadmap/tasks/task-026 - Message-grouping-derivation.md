---
id: task-026
title: Message grouping derivation
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

Pure view-model derivation for message grouping: speaker inheritance and the
grouping criteria (same type/speaker within the threshold). Derivation only —
never mutates stored messages.

## Acceptance Criteria

- [ ] #1 Consecutive same-type / same-speaker messages within the threshold group together
- [ ] #2 Speaker is inherited from the previous message when omitted and the type matches
- [ ] #3 Grouping is derived from message history without mutating any `msg` field
- [ ] #4 The derivation is a pure function of the message list

## Tests

- **Classes:** behaviour
- behaviour/example (pre-commit): #1, #2, #3 — grouping criteria and speaker inheritance
- behaviour/snapshot (pre-commit): #4 — golden grouped output for a fixture list

> Note: this derivation may move to the Phase 3 view-model layer; kept here as
> headless pure logic, tested without a DOM.

## Implementation Plan

`packages/systems/chat/src/model/grouping.ts`.

## Implementation Notes

_None yet._
