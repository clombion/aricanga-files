---
id: task-059
title: Save snapshot versioning + migrations
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [hardening, persistence, phase-7]
milestone: "Phase 7 — Hardening & standing guards"
dependencies: []
parent_task_id:
---

## Description

Version the persisted snapshot (the `Persist` payload + restored `Lifecycle`
state) and provide forward migrations so saves survive schema evolution. The
kernel restores from a current-version snapshot; migration is a pure transform
run at load.

## Acceptance Criteria

- [ ] #1 Every persisted snapshot carries a schema version
- [ ] #2 A pure migration chain upgrades an older snapshot to the current version at load
- [ ] #3 An unmigratable/unknown version fails closed with a clear error, never a silent partial restore
- [ ] #4 A round-trip (save current → load) and an upgrade (load old fixture → current) both restore valid kernel state

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (CI): #2, #4 — an old-version fixture migrates and restores; current-version round-trips
- constraint/contract (CI): #1, #3 — missing/unknown version fails closed with a located error

## Implementation Plan

`foundation/sim/snapshot.ts` versioning + a pure migration registry applied on restore.

## Implementation Notes

_None yet._
