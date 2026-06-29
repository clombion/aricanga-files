---
id: task-049
title: Desktop view components
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [experience, desktop, view, phase-5]
milestone: "Phase 5 — Desktop chat experience"
dependencies: [task-048]
parent_task_id:
---

## Description

Desktop-shaped Lit components that render the chat `ViewModel` — a multi-pane
desktop chat layout (chat list + thread) — proving the view layer consumes the
same pure `view(state, renderContext) → viewModel` output as the phone, only with
different chrome.

## Acceptance Criteria

- [ ] #1 Components render from the chat `ViewModel` with no chat-state access beyond it
- [ ] #2 Player actions are emitted as `Input`s (intents), never as direct state mutation
- [ ] #3 The desktop layout reuses chat view-models unchanged; only chrome/components differ from phone
- [ ] #4 Components pass the shared a11y harness (task-029 baseline)

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (CI): #1, #2 — a sample `ViewModel` renders; interactions dispatch the expected `Input`s
- constraint/architecture (CI): #3 — components import chat view-models, not chat state
- guard/tripwire (CI): #4 — axe sweep over desktop components

## Implementation Plan

`experiences/desktop-chat/src/view/`; consume `systems/chat` view-models; reuse a11y harness.

## Implementation Notes

_None yet._
