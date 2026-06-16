---
id: task-002
title: Vite build and dev pipeline
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [tooling, build, phase-0]
milestone: "Phase 0 — Walking skeleton & toolchain"
dependencies: [task-001]
parent_task_id:
---

## Description

Configure Vite as the bundler and dev server for an experience app, bundling
workspace packages from source (not prebuilt artifacts) so changes in foundation
or systems are picked up live.

## Acceptance Criteria

- [ ] #1 `vite dev` serves an experience app that imports from `foundation` workspace source
- [ ] #2 `vite build` produces a static bundle with no unresolved imports
- [ ] #3 Workspace/TS path resolution works with aliases declared in one place (or none needed)
- [ ] #4 The production bundle contains no references to the old POC packages

## Implementation Plan

`vite.config.ts` per experience; rely on pnpm workspace resolution; ESM only.

## Implementation Notes

_None yet._
