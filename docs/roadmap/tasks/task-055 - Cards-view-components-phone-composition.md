---
id: task-055
title: Cards view components + phone composition
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [experience, cards, view, phase-6]
milestone: "Phase 6 — Cards-on-phone experience"
dependencies: [task-053, task-054]
parent_task_id:
---

## Description

Lit card components rendering the cards `ViewModel`, composed inside the **same
`systems/phone` chrome** used by the chat phone experience — the recombination
that proves the phone shell is vocabulary-agnostic.

## Acceptance Criteria

- [ ] #1 Card components render from the cards `ViewModel` only
- [ ] #2 The experience reuses `systems/phone` chrome unchanged (status bar, home indicator, overlay)
- [ ] #3 Player swipes/choices dispatch cards `Input`s through the generic runtime
- [ ] #4 Components pass the shared a11y harness

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (CI): #1, #3 — a sample cards `ViewModel` renders; swipes dispatch expected `Input`s
- constraint/architecture (CI): #2 — `systems/phone` is imported unmodified; phase diff touches no phone source
- guard/tripwire (CI): #4 — axe sweep over card components

## Implementation Plan

`experiences/cards-on-phone/src/view/` + `main.ts`; compose `systems/phone` + cards view.

## Implementation Notes

_None yet._
