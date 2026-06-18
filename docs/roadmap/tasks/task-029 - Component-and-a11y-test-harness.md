---
id: task-029
title: Component and a11y test harness
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [ui, testing, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Lit)"
dependencies: [task-004, task-028]
parent_task_id:
---

## Description

The view-layer test substrate: render Lit components in happy-dom from a
view-model, assert emitted intents, run axe-core a11y checks, and configure
Playwright for the end-to-end parity proof. Comes first (TDD).

## Acceptance Criteria

- [ ] #1 A helper mounts a component with a given view-model in happy-dom and queries its shadow DOM
- [ ] #2 A helper asserts the intents (events) a component emits on interaction
- [ ] #3 axe-core runs against a mounted component and fails on violations
- [ ] #4 Playwright is configured to drive a composed experience for e2e/parity tests
- [ ] #5 Component/a11y subset runs locally; full e2e runs on the PR gate

## Tests

- **Classes:** guard (meta — this task builds the harness)
- guard/smoke (pre-commit): #1, #2, #3 — mount, intent-assert, and axe helpers work on a sample component
- guard/smoke (PR): #4 — Playwright boots a composed experience

> Carve-out: harness task — proven by the helpers running.

## Implementation Plan

Extend the task-004 Vitest setup with `@axe-core/playwright` + happy-dom helpers.

## Implementation Notes

_None yet._
