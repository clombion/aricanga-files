---
id: task-003
title: Solid component baseline
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-11-20
labels: [ui, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Solid)"
dependencies: [task-063, task-064]
parent_task_id:
---

## Description

The sandbox's message component as a Solid part mounted by a custom element:
the baseline pattern every Phase 3 part follows. It replaces the sandbox's Lit
`SkMessage` and removes `lit` from the workspace.

## Acceptance Criteria

- [ ] #1 A custom element renders one Solid root into its shadow root on connect and disposes it on disconnect
- [ ] #2 The message part is a function of a single `vm` prop that it reads without destructuring, and a new `vm` updates its text
- [ ] #3 `tsc -b` and oxlint (`eslint-plugin-solid` v2-strict) accept the part with zero findings
- [ ] #4 No file in the workspace imports `lit`, and no `package.json` depends on it

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (PR, real browsers): #1, #2 — mount, update and dispose in Chromium, Firefox and WebKit
- constraint/compile + lint (gate): #3
- constraint/architecture (gate): #4 — a harness check over the file listing

## Implementation Plan

Follow the mounting and adapter patterns ADR-0009 records from the
characterisation suite (task-063).

## Implementation Notes

_None yet._
