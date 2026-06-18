---
id: task-031
title: Rich message bubbles
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, ui, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Lit)"
dependencies: [task-030]
parent_task_id:
---

## Description

Non-text bubbles: image (with lightbox), audio (with transcribe action),
link-preview, and generic attachment — each a pure component over its view-model.

## Acceptance Criteria

- [ ] #1 Image bubble renders a thumbnail and opens a lightbox; emits an open/close intent
- [ ] #2 Audio bubble renders playback + a transcribe affordance; emits a transcribe intent
- [ ] #3 Link-preview renders title/desc/thumbnail from view-model data (no runtime fetch in the component)
- [ ] #4 Each bubble holds no domain state and is keyboard-operable + axe-clean

## Tests

- **Classes:** behaviour, non-functional
- behaviour/example (pre-commit): #1, #2, #3 — render + intents for each bubble type
- non-functional/a11y (PR): #4 — axe clean; lightbox focus management; controls labelled

## Implementation Plan

`packages/systems/chat/view/bubbles/*` (image, audio, link-preview, attachment).

## Implementation Notes

_None yet._
