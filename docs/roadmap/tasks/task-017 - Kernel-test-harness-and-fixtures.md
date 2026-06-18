---
id: task-017
title: Kernel test harness and fixtures
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [chat, testing, phase-2]
milestone: "Phase 2 — Chat simulation kernel (headless)"
dependencies: [task-004, task-008, task-011]
parent_task_id:
---

## Description

A headless driver that feeds ink output through the system reducer in Node, with
an injected fake clock and fixed seed, ink fixtures, and effect-stream/golden
capture. This is the substrate every kernel test stands on, so it comes first.

## Acceptance Criteria

- [ ] #1 A driver advances a compiled ink story and feeds each `StoryChunk` through `reduce`, collecting the effect stream and final snapshot
- [ ] #2 A fake clock and fixed seed are injected via `ReduceContext`, so runs are deterministic
- [ ] #3 Small ink fixtures exist for the core scenarios (single chat, cross-chat, choices)
- [ ] #4 The harness can capture an effect stream to a golden file and diff against it
- [ ] #5 Runs headless in Node (no DOM) under `vitest run`

## Tests

- **Classes:** guard (meta — this task builds the harness)
- guard/smoke (pre-commit): #1, #5 — the driver replays a fixture and returns a stream
- behaviour/example (pre-commit): #2 — same fixture + same seed/clock ⇒ identical stream
- guard/tripwire (CI): #4 — a changed stream fails the golden diff

> Carve-out: harness task — proven by replaying fixtures deterministically.

## Implementation Plan

`packages/systems/chat/test/harness.ts`; reuse the Vitest config from task-004.

## Implementation Notes

_None yet._
