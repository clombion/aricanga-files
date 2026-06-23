---
id: task-048
title: Desktop host shell + effect executor
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [experience, desktop, phase-5]
milestone: "Phase 5 — Desktop chat experience"
dependencies: [task-041, task-047]
parent_task_id:
---

## Description

A desktop experience shell that hosts the unchanged chat kernel: it owns the
impure resources (clock, scheduler, storage, ink runtime) and implements the
effect executor (`DriveInk`, `Schedule`, `Fetch`, `Present`, `Persist`) for a
desktop window. The kernel and its `Input`/`Effect` algebra are reused verbatim.

## Acceptance Criteria

- [ ] #1 The shell drives the chat kernel through the generic runtime with zero kernel edits
- [ ] #2 Every `Effect` kind has a desktop executor handler; an unknown kind throws
- [ ] #3 The shell owns all impure resources; no wall-clock or random call exists in kernel code reached from here
- [ ] #4 `Present` and `Persist` effects are realized against desktop sinks (DOM render target, local storage)

## Tests

- **Classes:** guard (+ constraint)
- guard/smoke (CI): #1, #4 — the shell boots the kernel and renders a first step
- constraint/architecture (CI): #2, #3 — exhaustive executor handler coverage; purity lint over kernel paths

## Implementation Plan

`experiences/desktop-chat/src/host/`; reuse `foundation/host` runtime + executor, supply desktop handlers.

## Implementation Notes

_None yet._
