---
id: task-064
title: Correctness harness and view toolchain
status: In Progress
assignee: []
created_date: 2026-11-20
updated_date: 2026-11-20
labels: [tooling, testing, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Solid)"
dependencies: []
parent_task_id:
---

## Description

The correctness harness of ADR-0006 over the rebuild, on the lint and format
toolchain the view layer needs: oxlint for `.ts`/`.tsx` (type-aware, with
`eslint-plugin-solid` v2-strict), Biome for CSS and JSON, oxfmt for formatting.
Every check proves itself on a planted violation and a near miss, one gate
command runs them all and writes no file, and the git hooks run the gate.
TypeScript moves to 7 only once the boundary lint has fixture parity on oxlint.

## Acceptance Criteria

- [ ] #1 One gate command runs every check and the tests, writes no file, and runs only locked tools; a fix command applies the fixers
- [ ] #2 Pre-commit runs the fast gate, pre-push runs the full gate and refuses `fixup!`/`squash!`/`amend!` commits, commit-msg enforces conventional commits
- [ ] #3 Every check in `harness.md` is implemented or recorded as not implemented with its evidence in `HARNESS_STATUS.md`, and a test keeps that file true
- [ ] #4 Every implemented check fails on its planted violation and passes its near miss
- [ ] #5 The boundary lint runs on oxlint with one must-fail and one must-pass fixture per boundary, matching the eslint verdicts it replaces
- [ ] #6 TypeScript is on 7, or stays on 6 with the parity gap recorded
- [ ] #7 `AGENTS.md` is the agent brief and `CLAUDE.md` points to it and to `node_modules/solid-js/skills/`

## Tests

- **Classes:** guard (meta)
- guard/planted (gate): #3, #4, #5 — each check's plants are tests
- guard/smoke (gate): #1, #2 — the gate and hook checks

## Implementation Plan

Port the reference Python starter harness's checks to the pnpm/TypeScript
monorepo; `harness.md` holds each check's mechanism.

## Implementation Notes

_None yet._
