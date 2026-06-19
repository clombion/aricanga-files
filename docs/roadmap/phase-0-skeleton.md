# Phase 0 — Walking skeleton & toolchain

**Labels:** `type:epic`, `area:tooling`
**Blocks:** Phase 1

## Risk retired

The new stack (TypeScript + Vite + Lit + Vitest + boundary lint) doesn't hang
together.

## Goal

Stand up the monorepo shape (foundation / systems / experiences) with the full
toolchain, threading one trivial ink story → kernel stub → one Lit component end
to end.

## Proof / Definition of Done

A single message renders through the full TS+Lit pipeline; boundary lint and CI
are green.

## Subtasks

See [`tasks/`](tasks/README.md) for the full task files with acceptance criteria.

- [x] task-001 — Monorepo and TypeScript project-reference scaffolding
- [ ] task-002 — Vite build and dev pipeline
- [ ] task-003 — Lit component baseline
- [ ] task-004 — Vitest unit-test harness
- [ ] task-005 — Module boundary lint
- [ ] task-006 — CI workflow (typecheck, lint, test, build)
- [ ] task-007 — Walking skeleton — ink → kernel stub → Lit render

## Non-goals

No physics, no real components, no build pipeline — scaffolding only.
