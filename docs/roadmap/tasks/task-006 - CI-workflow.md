---
id: task-006
title: CI workflow (typecheck, lint, test, build)
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
labels: [tooling, ci, phase-0]
milestone: "Phase 0 — Walking skeleton & toolchain"
dependencies: [task-001, task-002, task-004, task-005]
parent_task_id:
---

## Description

A GitHub Actions workflow running typecheck, boundary lint, unit tests, and build
on the new stack for every push and PR, so the skeleton stays green from day one.

## Acceptance Criteria

- [ ] #1 CI runs `tsc --build`, boundary lint, `vitest run`, and `vite build` on push and PR
- [ ] #2 A type error, lint violation, failing test, or broken build fails the workflow
- [ ] #3 The workflow uses pnpm with dependency caching
- [ ] #4 CI is green on the scaffolded skeleton

## Tests

- **Classes:** guard
- guard/smoke (CI gate): #1, #4 — the workflow runs every step and is green on the skeleton
- guard/tripwire (CI): #2 — each failure mode (type error, lint, test, build) fails the workflow, verified once with planted failures

> Carve-out: CI config — verified by the pipeline itself running.

## Implementation Plan

`.github/workflows/ci.yml`; pnpm/action-setup + cache; one job, sequential steps.

## Implementation Notes

`.github/workflows/rebuild-ci.yml` (separate from the POC's `deploy.yml`):
`pnpm/action-setup` + `setup-node@22` with pnpm cache; steps install (frozen) →
typecheck (`tsc -b`) → boundary lint → `test:rebuild` → `vite build`, on push to
`main`/`feat/**` and all PRs. Sequential steps, so any non-zero exit fails the job
(AC #2). All steps **dress-rehearsed locally and pass**, including
`--frozen-lockfile`; green-on-CI is confirmed when the PR runs (AC #4).
