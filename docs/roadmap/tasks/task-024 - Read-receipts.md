---
id: task-024
title: Read receipts
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

Receipt lifecycle: sent/delivered/read, the automatic upgrade when a reply
arrives, and explicit `# receipt` overrides (including update-by-label).

## Acceptance Criteria

- [ ] #1 Sent messages carry a receipt; a received reply upgrades the last `delivered` sent message to `read`
- [ ] #2 `# receipt:<status>` overrides automatic behaviour; `# receipt:read:<label>` updates a prior message by label
- [ ] #3 The My Notes chat has no receipts
- [ ] #4 Receipt changes are pure state transitions

## Tests

- **Classes:** behaviour
- behaviour/example (pre-commit): #1, #2, #3 — auto-upgrade, explicit override, by-label, the Notes exception
- behaviour/property (CI): the receipt-monotonicity invariant from task-018

## Implementation Plan

`packages/systems/chat/src/model/receipts.ts`.

## Implementation Notes

_None yet._
