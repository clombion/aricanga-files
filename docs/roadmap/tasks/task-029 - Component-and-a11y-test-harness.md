---
id: task-029
title: Component and a11y test harness
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-11-20
labels: [ui, testing, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Solid)"
dependencies: [task-063, task-028]
parent_task_id:
---

## Description

The view-layer test substrate, in real browsers: mount a Solid part with a given
view-model in Chromium, Firefox and WebKit (desktop and mobile emulation), assert
the intents it emits, run axe against it, and drive a composed experience for the
end-to-end parity proof. It comes first (TDD) and reuses the characterisation
suite's Playwright setup.

## Acceptance Criteria

- [ ] #1 A helper mounts a part with a given view-model inside a shadow root in a real browser and queries it
- [ ] #2 A helper asserts the intents (`Player` inputs) a part emits on a real user interaction
- [ ] #3 axe (`@axe-core/playwright`) runs against a mounted part and fails on a violation
- [ ] #4 Playwright drives a composed experience for e2e and parity tests
- [ ] #5 The part and a11y subsets run in all three browsers on the PR gate

## Tests

- **Classes:** guard (meta — this task builds the harness)
- guard/smoke (PR): #1, #2, #3 — each helper fails on a planted defect (a missing node, a wrong intent, an unlabelled control) and passes on a near miss
- guard/smoke (PR): #4 — Playwright boots a composed experience

## Implementation Plan

Extend `packages/characterisation`'s Playwright projects; happy-dom is not a
real browser and is not used for parts.

## Implementation Notes

_None yet._
