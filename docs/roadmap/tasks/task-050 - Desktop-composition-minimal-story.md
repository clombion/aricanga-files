---
id: task-050
title: Desktop experience composition + minimal story
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [experience, desktop, phase-5]
milestone: "Phase 5 — Desktop chat experience"
dependencies: [task-048, task-049]
parent_task_id:
---

## Description

A thin composition root wiring the desktop shell, the chat kernel, and the
desktop view over a minimal ink story and config, yielding a runnable desktop
chat experience built entirely from the typed pipeline.

## Acceptance Criteria

- [ ] #1 A composition root wires kernel + runtime + desktop view with no globals or singletons
- [ ] #2 A minimal story + config drive a playable desktop chat end to end
- [ ] #3 The world (story, seeds, i18n/data, config) comes from the Phase 4 build, not hand-authored fixtures
- [ ] #4 The experience boots, plays a short branch, and persists/restores via `Persist`

## Tests

- **Classes:** behaviour (+ guard)
- behaviour/example (CI): #2, #4 — scripted play advances a branch; save→restore round-trips
- guard/smoke (CI): #1, #3 — composition root boots over a built world

## Implementation Plan

`experiences/desktop-chat/src/main.ts` + a minimal `content/`; consume the Phase 4 pipeline output.

## Implementation Notes

_None yet._
