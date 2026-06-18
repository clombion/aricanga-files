---
id: task-039
title: Aricanga view parity (phase proof)
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, phone, ui, testing, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Lit)"
dependencies: [task-030, task-031, task-032, task-033, task-034, task-035, task-036, task-037, task-038]
parent_task_id:
---

## Description

The Phase 3 integrating proof: Aricanga runs end-to-end on the new stack — phone +
chat composed — at behavioural parity with the POC reference. Retires the "Lit
view-models can't reproduce the UI/a11y" risk.

## Acceptance Criteria

- [ ] #1 Aricanga boots on the new stack and plays through the core story paths via the UI
- [ ] #2 Behaviour matches the POC reference on the key flows (messages, notifications, choices, receipts, lock screen)
- [ ] #3 Phone + chat are composed via the multi-system seam, foreground = chat
- [ ] #4 axe acceptance (task-038) passes on the composed Aricanga app
- [ ] #5 Golden/visual checks are pinned for the main screens

## Tests

This task **is** the Phase 3 acceptance test.

- **Classes:** behaviour (phase acceptance test), non-functional
- behaviour/e2e (PR): #1, #2, #3 — Playwright drives Aricanga to parity with the reference on the key flows
- non-functional/a11y (PR): #4 — axe acceptance on the composed app
- behaviour/snapshot (PR): #5 — pinned visual/markup goldens for the main screens

## Implementation Plan

Playwright parity spec diffing key-flow behaviour against the POC reference branch.

## Implementation Notes

_None yet._
