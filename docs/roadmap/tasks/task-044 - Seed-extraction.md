---
id: task-044
title: Seed extraction to the Lifecycle(Init) payload
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [build, chat, phase-4]
milestone: "Phase 4 — Build pipeline & config"
dependencies: [task-043]
parent_task_id:
---

## Description

Extract pre-`# story_start` seed messages at build time into the shape the kernel's `Lifecycle(Init)` input consumes for a fresh game (backstory shown as pre-existing history, no time, no notifications).

## Acceptance Criteria

- [ ] #1 Messages before `# story_start` are extracted, marked `_isSeed`, grouped per chat
- [ ] #2 The output is exactly the `Lifecycle(Init)` payload shape the chat kernel restores
- [ ] #3 Extraction is deterministic and ids are build-stable (no `Date.now`/random)
- [ ] #4 A staleness check flags seeds older than their ink source

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (CI): #1, #2 — extraction over a fixture story produces the expected per-chat seed payload
- constraint/architecture (CI): #3, #4 — deterministic ids; staleness check fires on a stale seed

## Implementation Plan

`packages/build/src/extract-seeds.ts`; emits the `Lifecycle(Init)` payload.

## Implementation Notes

_None yet._
