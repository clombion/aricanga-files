---
id: task-018
title: Simulation-physics invariant suite (property-based)
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-28
labels: [chat, foundation, testing, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-017]
parent_task_id:
---

## Description

The property-based acceptance contract for the chat physics, over the task-017
harness. It authors the full invariant library now — each documented rule from
`docs/concepts/simulation-physics.md` as a pure predicate over the kernel-observable
`Input→Effect`+`state` stream — plus the standing algebra guards (ADR-0007) that
hold for any system today. Tasks 020–026 **consume** these predicates: each physics
task imports its predicate and drives the reducer until its green property test
passes. Authorship is here; consumption distributes — so the dependency graph the
physics tasks encode ("the X invariant from task-018") is real.

Most invariants are properties of the **observable stream**, not internal state
(routing → `present.chatId`; notify-once → notification effects per chat between
opens; forward-only time → monotonic `TimeChanged` effects; receipts → upgrade
effects), so predicates target the observable and the chat state shape is not
expanded ahead of the physics that needs it.

## Acceptance Criteria

- [ ] #1 fast-check is added; `foundation/testing` provides coherent `InkStep`-stream generators (status ⇔ choices/externalCalls) and valid `Player` open/close interleavings — no shapes the real pump can't produce
- [ ] #2 A run-twice determinism property (`canonical(traceA) === canonical(traceB)` over generated streams, excluding data-request steps) is the standing determinism guard; it is green over the stub and a planted nondeterminism fails it with a shrunk counterexample
- [ ] #3 A purity lint bans `Date.now`/`Math.random`/`new Date` over the reducer/model surface (not locale — `view` reads `RenderContext.locale`); green over the stubs, red on a planted clock read
- [ ] #4 Every `simulation-physics.md` invariant exists as a pure predicate `(stream) → Violation | null`: the generic runner + determinism live in `foundation/testing`; the chat-specific predicates live in `@narratives/system-chat/testing` (foundation cannot import chat)
- [ ] #5 The predicates the stub already satisfies (routing ownership, determinism) have green property tests now; the rest are the executable acceptance contract consumed by 020–026 — no `.skip`, no excluded "expected-red" run
- [ ] #6 The property runner drives generated streams through the real runtime over a guaranteed-ended ink story (`-> END`) with `chatSystem` pinned sole + foreground, so generated steps route deterministically and never interleave with authored ink

## Tests

This task **is** test code; its deliverable is the generators, the standing guards,
and the predicate library.

- **Classes:** behaviour (+ guard, constraint)
- behaviour/property (CI; deep run on-demand): #2, #6 — determinism holds over generated streams; a counterexample shrinks
- guard/tripwire (pre-commit): #2, #3 — planted nondeterminism fails the determinism property; a planted `Date.now` in a reducer fails the purity lint
- behaviour/property (CI): #5 — the routing-ownership predicate holds over generated targetChat streams
- constraint/architecture (pre-commit): #4 — generic runner/determinism in `foundation/testing`; chat predicates in `@narratives/system-chat/testing`; no chat import in foundation

## Implementation Plan

- Add `fast-check` (root devDep).
- `foundation/testing`: coherent `InkStep`/`Player` generators, the property runner
  (generated `Story(InkStep)` over an ended ink story, `chatSystem` pinned
  sole/foreground), the run-twice determinism property.
- `@narratives/system-chat/testing` (new built subpath, mirroring `foundation/testing`):
  the chat invariant predicates over the observable stream (routing, notify-once,
  HWM, forward-only time, receipts, seed exclusion, grouping). 020–026 import these.
- `eslint.config.js`: a `no-restricted-syntax` block over the reducer/model surface.

## Implementation Notes

_None yet._
