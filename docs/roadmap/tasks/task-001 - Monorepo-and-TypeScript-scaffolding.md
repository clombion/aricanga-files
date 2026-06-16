---
id: task-001
title: Monorepo and TypeScript project-reference scaffolding
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-16
labels: [tooling, foundation, phase-0]
milestone: "Phase 0 — Walking skeleton & toolchain"
dependencies: []
parent_task_id:
---

## Description

Establish the workspace layout (`packages/foundation`, `packages/systems/*`,
`experiences/*`) with pnpm workspaces and TypeScript project references plus a
strict base tsconfig, so the layered architecture has a physical home and types
compile across package boundaries.

## Acceptance Criteria

- [ ] #1 `pnpm-workspace.yaml` includes the foundation, systems, and experiences globs
- [ ] #2 Package skeletons exist for `foundation`, at least one system, and one experience, each with its own `package.json` and `tsconfig.json`
- [ ] #3 A strict base tsconfig (`strict`, `noUncheckedIndexedAccess`, ESM resolution) is extended by every package
- [ ] #4 `tsc --build` type-checks the whole workspace with zero errors
- [ ] #5 An experience can import a foundation export and the types resolve across the package boundary

## Implementation Plan

`pnpm-workspace.yaml`; root `tsconfig.base.json`; per-package `tsconfig.json`
with `composite: true` and `references`.

## Implementation Notes

_None yet._
