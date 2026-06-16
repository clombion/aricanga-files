---
id: task-003
title: Lit component baseline
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [ui, phase-0]
milestone: "Phase 0 — Walking skeleton & toolchain"
dependencies: [task-001, task-002]
parent_task_id:
---

## Description

Add Lit and establish the base Web Component pattern (a `LitElement` with
reactive properties and Shadow DOM) plus the TypeScript configuration it needs
(decorators / `useDefineForClassFields`), so view-layer work in Phase 3 has a
proven baseline.

## Acceptance Criteria

- [ ] #1 A minimal `LitElement` component renders into Shadow DOM in the Vite app
- [ ] #2 Changing a reactive property re-renders the component
- [ ] #3 TypeScript compiles the Lit component under strict mode with zero errors
- [ ] #4 The component registers as a custom element and appears on the page

## Implementation Plan

Add `lit`; set tsconfig decorator options; one example `LitElement` rendered by
the Vite app.

## Implementation Notes

_None yet._
