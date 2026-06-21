---
id: task-003
title: Lit component baseline
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
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

## Tests

- **Classes:** behaviour
- behaviour/example (pre-commit): #1, #2, #4 — renders into shadow DOM, reactive property re-renders, registers as a custom element (happy-dom)
- constraint/compile (pre-commit): #3 — strict `tsc` accepts the Lit component

## Implementation Plan

Add `lit`; set tsconfig decorator options; one example `LitElement` rendered by
the Vite app.

## Implementation Notes

Added a **no-decorator** `SkMessage` `LitElement` (static `properties`, `declare
text`, constructor init) — compiles clean under strict TS + `useDefineForClassFields`
with no decorator config. Wired into the sandbox app (`main.ts` renders an
`<sk-message>`). `lit ^3.3` added to the sandbox.

Verified by the happy-dom component test (`sk-message.test.ts`, from task-004):
registered as a custom element (#4), renders text into shadow DOM (#1), and
re-renders on property change (#2). `tsc -b` compiles it under strict mode (#3).
