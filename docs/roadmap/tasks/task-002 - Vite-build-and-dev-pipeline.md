---
id: task-002
title: Vite build and dev pipeline
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
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

## Tests

- **Classes:** guard
- guard/smoke (CI gate): #1, #2 — `vite dev` serves and `vite build` produces a bundle with no unresolved imports
- constraint/architecture (pre-commit): #4 — static check: no reference to any old POC package

## Implementation Plan

`vite.config.ts` per experience; rely on pnpm workspace resolution; ESM only.

## Implementation Notes

Sandbox is now a Vite app: `index.html` → `src/main.ts`. Workspace packages are
aliased to their TS **source** in `vite.config.ts` (one place — AC #3), so dev and
build compile from source with no dependence on `dist/`. Vite `outDir` is `build/`
(separate from tsc's `dist/`, gitignored).

Verified: `vite build` transforms 5 modules, the bundle contains the bootstrap
text and **no POC package references** (AC #2, #4); `vite dev` serves `HTTP 200`
and transforms the TS entry on request (AC #1).
