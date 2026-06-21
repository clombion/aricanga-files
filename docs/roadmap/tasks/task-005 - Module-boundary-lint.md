---
id: task-005
title: Module boundary lint
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
labels: [tooling, foundation, phase-0]
milestone: "Phase 0 — Walking skeleton & toolchain"
dependencies: [task-001]
parent_task_id:
---

## Description

Enforce the layered dependency direction by lint so violations fail
mechanically instead of relying on review: foundation depends on nothing;
systems depend only on foundation, never on each other; experiences depend on
foundation + chosen systems. This is the structural rule that lets ~60 bespoke
linters collapse.

## Acceptance Criteria

- [ ] #1 An import from `foundation` into a system is allowed; the reverse (system → foundation internals notwithstanding, framework importing a system upward) fails lint
- [ ] #2 An import from one system into another system fails lint
- [ ] #3 An import from an experience into foundation/systems is allowed; any foundation/system import of an experience fails lint
- [ ] #4 The boundary lint runs in CI and fails the build on violation

## Tests

- **Classes:** constraint
- constraint/architecture (pre-commit): #1, #2, #3 — fixture imports exercise each rule: allowed directions pass; forbidden (system→system, framework→experience, reverse-layer) fail lint
- guard/tripwire (CI): #4 — a planted violation fails the build

> The lint *is* the test; the fixtures prove each rule.

## Implementation Plan

ESLint flat config with `eslint-plugin-boundaries` (element types per layer), or
the Biome equivalent if preferred. One rule set, no per-file scripts.

## Implementation Notes

ESLint 10 flat config (`eslint.config.js`) with `eslint-plugin-boundaries` v6
(`boundaries/dependencies`) + `eslint-import-resolver-typescript`. Element types:
`foundation` (`packages/foundation`), `system` (`packages/systems/*`, captured
name), `experience` (`experiences/*`). Rules: foundation → nothing; system →
foundation only; experience → foundation + system; `default: disallow`. POC paths
are ignored; script `lint:boundaries` (`eslint .`).

Verified empirically: clean pass (no warnings); a planted `foundation → system`
import errors (rule index 0), and a planted `system → system` import errors
("no rule allowing… system 'chat'") — both exit 1; allowed directions pass.
CI wiring (AC #4) lands in task-006.
