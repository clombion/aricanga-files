---
id: task-001
title: Monorepo and TypeScript project-reference scaffolding
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
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

## Tests

- **Classes:** constraint
- constraint/compile (pre-commit): #3, #4, #5 — `tsc --build` passes; a cross-package import type-resolves
- constraint/architecture (pre-commit): #1, #2 — a static check asserts the workspace globs and package skeletons exist

> Carve-out: scaffolding — verified by the build succeeding, not example tests.

## Implementation Plan

`pnpm-workspace.yaml`; root `tsconfig.base.json`; per-package `tsconfig.json`
with `composite: true` and `references`.

## Implementation Notes

Scaffolded **additively** alongside the POC (no POC files removed; it stays as the
read-only reference oracle, removed in Phase 7).

- `tsconfig.base.json` — strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `composite`); solution-style root `tsconfig.json` with
  project references.
- New packages: `@narratives/foundation`, `@narratives/system-chat` (deps foundation),
  and `experiences/sandbox` (deps both) — each with a composite tsconfig extending base.
- Workspace glob `packages/systems/*` added; `typescript ^5.7` + a `typecheck` script
  added to the root; `dist/` and `*.tsbuildinfo` gitignored.
- `pnpm install` links the workspace; `pnpm exec tsc -b` builds all three projects in
  dependency order with **zero errors**. `sandbox/main.ts` imports from both packages,
  proving cross-package type resolution (AC #5).
