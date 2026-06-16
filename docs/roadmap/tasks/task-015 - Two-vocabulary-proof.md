---
id: task-015
title: Two-vocabulary proof
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [foundation, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-012, task-013, task-014]
parent_task_id:
---

## Description

The Phase 1 integrating proof: compose the root with the chat stub, then with the
cards stub, and demonstrate the foundation is genuinely vocabulary-agnostic. This
retires the phase's risk at compile time.

## Acceptance Criteria

- [ ] #1 `createExperience` runs with `chatSystem` and, separately, with `cardsSystem` — same foundation, different system argument only
- [ ] #2 Switching between the two systems touches zero files under `foundation/`
- [ ] #3 The whole workspace type-checks with both stubs wired
- [ ] #4 A test feeds a chunk through each system and asserts the expected effect kind (`chat/showNotification` vs `cards/statChanged`)
- [ ] #5 Boundary lint passes: neither stub imports the other, and foundation imports neither

## Implementation Plan

A tiny harness experience or test that constructs both and asserts the above.

## Implementation Notes

This is the compile-time half of the design-for-two proof (see ADR-0004); the
runtime halves are Phases 5 and 6.
