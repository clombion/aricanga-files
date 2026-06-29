---
id: task-060
title: Docs consolidation to the algebra contract
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [hardening, docs, phase-7]
milestone: "Phase 7 — Hardening & standing guards"
dependencies: []
parent_task_id:
---

## Description

Consolidate the rebuild documentation around the single algebra contract
(ADR-0007 + the foundation contract): one authoritative description of the
`System`, `Input`/`Effect`, runtime, and host responsibilities, with the
phase/roadmap docs pointing to it rather than restating it.

## Acceptance Criteria

- [ ] #1 A single canonical contract doc describes `System`, `Input`/`Effect`, runtime, and host duties
- [ ] #2 Phase and roadmap docs reference the contract instead of duplicating it
- [ ] #3 Superseded planning notes and POC-era concept docs are removed or marked historical
- [ ] #4 Docs are declarative (goal/context/what/why) — no evolution narrative

## Tests

- **Classes:** constraint (docs)
- constraint/contract (PR): #1, #2 — link check: phase docs resolve to the canonical contract; no duplicated definitions
- constraint/architecture (PR): #3, #4 — superseded docs are gone/marked; review confirms no journey narration

## Implementation Plan

Fold `phase-1-foundation-design.md` + ADR-0007 into the canonical contract; repoint phase docs.

## Implementation Notes

_None yet._
