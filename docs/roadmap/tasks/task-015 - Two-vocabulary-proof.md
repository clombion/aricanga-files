---
id: task-015
title: Two-vocabulary proof
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [foundation, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-012, task-013, task-014, task-016]
parent_task_id:
---

## Description

The Phase 1 integrating proof: register the chat and cards stubs together in one
experience and route chunks by tag, demonstrating the foundation is genuinely
vocabulary-agnostic and that systems coexist (ADR-0005). This retires the phase's
risk at compile time.

## Acceptance Criteria

- [ ] #1 `createExperience` runs with both `chatSystem` and `cardsSystem` registered together; a chat-tagged chunk routes to chat and a card-tagged chunk routes to cards
- [ ] #2 Adding or removing either system touches zero files under `foundation/`
- [ ] #3 The whole workspace type-checks with both stubs wired
- [ ] #4 A test feeds a chunk through each system and asserts the expected effect kind (`chat/showNotification` vs `cards/statChanged`)
- [ ] #5 Boundary lint passes: neither stub imports the other, and foundation imports neither

## Implementation Plan

A tiny harness experience or test that constructs both and asserts the above.

## Implementation Notes

This is the compile-time half of the design-for-two proof (see ADR-0004); the
runtime halves are Phases 5 and 6.
