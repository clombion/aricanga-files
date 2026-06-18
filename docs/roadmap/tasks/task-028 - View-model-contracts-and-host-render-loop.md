---
id: task-028
title: View-model contracts and UI host render loop
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [ui, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Lit)"
dependencies: [task-003, task-011, task-012]
parent_task_id:
---

## Description

Define the chat/phone view-model shapes produced by `deriveViewModel`, and the UI
host that maps `snapshot → deriveViewModel → Lit render` and routes component
intents back to the kernel. Foundation stays DOM-free; the render loop lives in a
`ui`/host layer.

## Acceptance Criteria

- [ ] #1 `ChatViewModel` (hub list, thread view, typing, receipts) is a pure projection of `ChatState`
- [ ] #2 A UI host subscribes to snapshot changes, calls `deriveViewModel`, and (re)renders Lit components; foundation contains no DOM imports
- [ ] #3 Components receive their view-model slice as input and emit intents as DOM events — they hold no domain state
- [ ] #4 An intent event is translated by the host into a kernel input (advance / choice / navigation)
- [ ] #5 A view-model change re-renders only the affected components (keyed rendering)

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #1, #3, #4 — projection; a component renders from a VM and emits an intent; host maps intent → kernel input
- constraint/architecture (pre-commit): #2 — boundary check: no DOM import in foundation
- behaviour/example (pre-commit): #5 — a VM delta re-renders only the changed component

## Implementation Plan

`packages/ui/host.ts` + per-system `deriveViewModel`; Lit render via keyed templates.

## Implementation Notes

_None yet._
