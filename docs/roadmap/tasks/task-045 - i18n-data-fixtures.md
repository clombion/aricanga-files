---
id: task-045
title: i18n/data fixtures (host-injected name/data, locale-pinned)
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [build, i18n, phase-4]
milestone: "Phase 4 — Build pipeline & config"
dependencies: [task-042]
parent_task_id:
---

## Description

Generate the deterministic lookups the host binds to the `name` and `data` ink
externals — per-locale name variants and data values — so an `InkStep.text` is
reproducible from `(story, locale, lookups)` alone. The lookups are plain data
produced by the build and injected by the host; the kernel never reads them.

## Acceptance Criteria

- [ ] #1 The build emits a per-locale lookup table for `name` and `data` from config + content
- [ ] #2 The host binds those tables to the ink externals as pure total functions (every referenced key resolves)
- [ ] #3 The active locale is pinned per build; switching locale is a different build artifact, never a runtime branch in the kernel
- [ ] #4 i18n parity (every key present in every configured locale) is a schema/derivation check, not a bespoke linter

## Tests

- **Classes:** constraint (+ behaviour)
- constraint/contract (CI): #1, #4 — a fixture with a missing locale key fails parity with the offending key/locale
- behaviour/example (CI): #2 — bound externals resolve every referenced key over a fixture story
- constraint/architecture (pre-commit): #3 — the kernel has no locale branch; locale enters only via host-bound externals

## Implementation Plan

`packages/build/src/i18n-fixtures.ts`; emits per-locale tables; host binds them in the ink runtime setup.

## Implementation Notes

_None yet._
