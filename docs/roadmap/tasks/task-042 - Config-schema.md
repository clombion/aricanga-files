---
id: task-042
title: Config schema (Zod) as the single source of truth
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [build, tooling, phase-4]
milestone: "Phase 4 — Build pipeline & config"
dependencies: []
parent_task_id:
---

## Description

A Zod schema is the single source of truth for an experience's configuration: characters, chats (id ↔ ink knot, display), theme, timings (e.g. grouping threshold), and locales. It validates config at build time and its inferred types are consumed by the host (the chat registry used for `Player(Open)` validation) and the build — replacing the bespoke config↔ink parity linters.

## Acceptance Criteria

- [ ] #1 The schema defines characters, chats (id ↔ knot, display name), theme, timings, and locales
- [ ] #2 The build fails with a precise, located error on invalid or missing config
- [ ] #3 The schema's inferred types are the only config types — no parallel hand-written config interfaces
- [ ] #4 chat ↔ ink consistency (every chat has a knot; every `targetChat` resolves) is a schema/derivation check, replacing the ad-hoc parity linters

## Tests

- **Classes:** constraint
- constraint/contract (CI): #1, #2, #4 — valid fixtures pass; invalid/missing config and an unresolved `targetChat` fail with a located error
- constraint/compile (pre-commit): #3 — host and build consume the inferred types; no parallel config types compile

## Implementation Plan

`packages/build/src/config-schema.ts` (Zod); inferred types exported to host + build.

## Implementation Notes

_None yet._
