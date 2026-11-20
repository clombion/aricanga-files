---
id: task-063
title: Solid runtime characterisation suite
status: In Progress
assignee: []
created_date: 2026-11-20
updated_date: 2026-11-20
labels: [ui, testing, phase-3]
milestone: "Phase 3 — Chat + phone view layer (Solid)"
dependencies: [task-064]
parent_task_id:
---

## Description

Every claim about Solid 2.0's runtime that the view layer relies on, as a
real-browser test against the pinned versions (solid-js 2.0.3, @solidjs/web
2.0.3, @solidjs/compiler 2.0.2, @solidjs/vite-plugin 3.0.1). It is the hard gate
before any view code, it reruns on every Solid upgrade, and ADR-0009 is written
from its results. A test that contradicts an assumed behaviour wins: the
contradiction is recorded with its evidence and the design changes.

## Acceptance Criteria

- [ ] #1 Mounting and ownership: one root per experience, rendered into a shadow root in `connectedCallback` and disposed in `disconnectedCallback`; the owner and diagnostic behaviour of creating a root inside an effect, and of `runWithOwner(null, …)`, is recorded
- [ ] #2 Snapshot adapter: a store reconciled by id from outside any reactive scope (including from timers) updates only changed items; a write from inside an owned scope is refused or reported as the runtime does
- [ ] #3 Synchronous views: the runtime's behaviour for a promise or async read inside a part is recorded
- [ ] #4 Failure model: an error boundary per part contains a throwing part; what cleanup runs for the throwing branch is recorded
- [ ] #5 Measurement: the order of `apply → flush → layout callback`, and what `flush()` does inside an effect and inside `onSettled`, is recorded
- [ ] #6 Events: delegated handlers fire on real user interaction; a synthetic non-bubbling dispatch's reach is recorded
- [ ] #7 Properties: JSX `value`/`checked`/`selected` are set as properties; the `default…` forms set initial state only
- [ ] #8 Props: a single `vm` prop read without destructuring satisfies `eslint-plugin-solid` v2-strict and stays reactive
- [ ] #9 CSP: the suite's pages run under `script-src 'self'; style-src 'self'`; what the compiler emits for a `style` prop is recorded
- [ ] #10 Performance: 1,000 messages rendered and 100 snapshot updates applied, timed per browser, with a stored baseline that fails on a regression over 25 %
- [ ] #11 Every item above passes, or is a recorded contradiction, in Chromium, Firefox and WebKit (desktop and mobile emulation)
- [ ] #12 ADR-0009 records the runtime model from these results

## Tests

- **Classes:** guard (characterisation)
- guard/characterisation (PR, real browsers): #1–#11, one spec per surface under `packages/characterisation/tests`

## Implementation Plan

`packages/characterisation`: a dev-build fixture app (diagnostics print), a
result bus the specs read, one fixture per claim.

## Implementation Notes

The harness and the mount-and-dispose fixture pass in all five projects.
