---
id: task-038
title: Accessibility acceptance sweep
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [ui, testing, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Lit)"
dependencies: [task-030, task-031, task-032, task-033, task-034, task-035, task-036, task-037]
parent_task_id:
---

## Description

Holistic accessibility acceptance on the composed app — beyond the per-component
checks: axe clean across views, full keyboard operability, focus management, ARIA
roles/names, and reduced-motion.

## Acceptance Criteria

- [ ] #1 axe-core reports no violations across hub, thread, notifications, and lock screen
- [ ] #2 The whole flow (hub → open chat → make a choice → back) is operable by keyboard alone
- [ ] #3 Focus order and visible focus are correct across navigation and overlays
- [ ] #4 Reduced-motion disables non-essential animation app-wide
- [ ] #5 A screen-reader pass on the key flow is documented

## Tests

- **Classes:** non-functional (acceptance)
- non-functional/a11y (PR): #1, #3, #4 — axe clean on composed views; focus + reduced-motion
- behaviour/e2e (PR): #2 — keyboard-only walkthrough of the core flow

> #5 is a manual screen-reader pass recorded in Implementation Notes.

## Implementation Plan

A Playwright + axe acceptance spec over the composed Aricanga app.

## Implementation Notes

_None yet._
