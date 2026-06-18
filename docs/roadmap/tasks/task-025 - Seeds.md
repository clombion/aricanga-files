---
id: task-025
title: Seeds
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, phase-2]
milestone: "Phase 2 — Chat simulation kernel (headless)"
dependencies: [task-020]
parent_task_id:
---

## Description

Runtime handling of build-extracted seeds: seeded backstory loads into history
with no time advance, no notifications, and only on first visit.

## Acceptance Criteria

- [ ] #1 Messages before `# story_start` are marked `_isSeed` and loaded into initial history
- [ ] #2 Seeds advance neither the clock nor fire notifications
- [ ] #3 Seeds appear only on first visit (guarded by knot-visit count)
- [ ] #4 Seed handling is pure given the build-extracted seed input

## Tests

- **Classes:** behaviour
- behaviour/example (pre-commit): #1, #2, #3 — seed loading, exclusion from time/notifications, first-visit only
- behaviour/property (CI): the seed-exclusion invariant from task-018

## Implementation Plan

`packages/systems/chat/src/model/seeds.ts`; consumes the Phase 4 seed artifact.

## Implementation Notes

_None yet._
