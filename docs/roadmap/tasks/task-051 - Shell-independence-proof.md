---
id: task-051
title: Shell-independence proof (chat without phone)
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [experience, desktop, proof, phase-5]
milestone: "Phase 5 — Desktop chat experience"
dependencies: [task-050]
parent_task_id:
---

## Description

The integrating proof for Phase 5: the chat kernel and its view-models drive a
desktop experience with **zero edits** to `foundation/` or `systems/chat`, and
with **no dependency on `systems/phone`**. The seam is proven by subtraction —
removing the phone chrome leaves chat fully functional.

## Acceptance Criteria

- [ ] #1 The desktop experience builds and runs with no import of `systems/phone`
- [ ] #2 No commit in this phase modifies `foundation/` or `systems/chat` to make desktop work
- [ ] #3 The same chat `Input`/`Effect` algebra and view-models are reused verbatim across phone and desktop
- [ ] #4 A boundary lint forbids `experiences/desktop-chat` → `systems/phone`

## Tests

- **Classes:** constraint (phase proof)
- constraint/architecture (CI): #1, #4 — boundary lint denies the phone dependency; build succeeds without it
- constraint/architecture (PR): #2, #3 — phase diff touches no foundation/chat source; view-model types are shared, not forked

## Implementation Plan

Boundary rule in `eslint.config.js`; a phase-diff check asserting no foundation/chat edits.

## Implementation Notes

_None yet._
