---
id: task-028
title: View-model contracts and snapshot adapter
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-11-20
labels: [ui, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Solid)"
dependencies: [task-003, task-011, task-012]
parent_task_id:
---

## Description

The chat and phone view-model shapes produced by each system's `view`, and the
host side that carries them to Solid: a snapshot adapter that holds one Solid
store per mounted experience and reconciles each new view-model into it by id,
and the mount seam that routes part intents back to the kernel. `System.view`
already is the pure projection; foundation and system models stay free of DOM
and of Solid.

## Acceptance Criteria

- [ ] #1 `ChatViewModel` (hub list, thread view, typing, receipts) is a pure projection of `ChatState`
- [ ] #2 The host applies each snapshot to the adapter outside any reactive scope, after each `send`/`step`; nothing under `packages/foundation` or `packages/systems/*/src/model` imports `solid-js` or `@solidjs/*`
- [ ] #3 Parts receive their view-model slice as their single `vm` prop and emit intents as `Player` inputs through `experience.send` — they hold no domain state
- [ ] #4 An intent is translated by the host into a kernel input (advance / choice / navigation)
- [ ] #5 A view-model change updates only the DOM nodes of the items whose data changed (reconcile by id)
- [ ] #6 `createStore` and `reconcile` appear only in the snapshot adapter module

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (gate): #1 — projection over `ChatState`
- behaviour/example (PR, real browsers): #3, #4, #5 — a part renders from a VM and emits an intent; the host maps it to a kernel input; a VM delta leaves unchanged items' nodes untouched
- constraint/architecture (gate): #2, #6 — project lint rules, each with a must-fire and a must-stay-clean fixture

## Implementation Plan

Per ADR-0009: the adapter module, the mount-once custom element, and the
`Parts` type each system view package exports.

## Implementation Notes

_None yet._
