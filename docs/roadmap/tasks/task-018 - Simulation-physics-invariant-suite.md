---
id: task-018
title: Simulation-physics invariant suite (property-based)
status: Done
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
harness. It authors the property invariants now — each rule from
`docs/concepts/simulation-physics.md` as a pure predicate over the kernel-observable
`Input→Effect`+`state` stream — plus the standing algebra guards (ADR-0007) that
hold for any system today. Each physics task's acceptance test references its
invariant "from task-018" (routing → 020; notify-once → 021; HWM/read-cursor → 022;
forward-only time → 023; receipts → 024; seed exclusion → 021 and 025): authorship
is here, consumption distributes. (Grouping is a deterministic view derivation, not
a property invariant — task-026 covers it by golden, so it is not authored here.)

Each predicate targets its natural observable: transient events over the effect
stream (notify-once → notification effects per chat between opens; receipts →
`chat/receiptChanged` upgrade effects, which task-024 will emit), persistent values
over state (routing, the HWM cursor, and — resolved in task-023 — the forward-only
clock read from `state.clock`, not an effect). Routing
ownership reads the input `targetChat` against the resulting routing (the stub emits
a notification effect only for background chats, so routing is read from the
input/state, not from effects alone). The chat state shape is already full (ADR-0004,
`state.ts`), so no expansion is pulled ahead of the physics.

## Acceptance Criteria

- [ ] #1 fast-check is added; `foundation/testing` provides coherent `InkStep`-stream generators (status ⇔ choices/externalCalls) and valid `Player` open/close interleavings — no shapes the real pump can't produce
- [ ] #2 A run-twice determinism property (`canonical(traceA) === canonical(traceB)` over generated streams, excluding data-request steps) is the standing determinism guard; it is green over the stub and a planted nondeterminism fails it with a shrunk counterexample
- [ ] #3 A new (net-new, not yet present) `no-restricted-syntax` lint block bans `Date.now`/`Math.random`/`new Date` over the chat reducer surface — `system.ts` (where `reduce` lives today) and a future `model/**` — but not `view`/locale; green over the stubs, red on a planted clock read
- [ ] #4 Every property invariant in `simulation-physics.md` exists as a pure predicate `(stream) → Violation | null` (routing, notify-once, HWM, forward-only time, receipts, seed exclusion; grouping excluded — it is a view golden in 026): the generic runner + determinism live in `foundation/testing`; the chat-specific predicates live in a built `@narratives/system-chat/testing` subpath (foundation cannot import chat), wired with a `./testing` package `exports` entry + a vitest alias, mirroring `foundation/testing`
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
- `@narratives/system-chat/testing` (new built subpath): the chat invariant predicates
  over the observable stream (routing, notify-once, HWM, forward-only time, receipts,
  seed exclusion — not grouping). Requires `system-chat/package.json` to gain a
  `"./testing"` `exports` entry and `vitest.rebuild.config.ts` a
  `@narratives/system-chat/testing` alias (mirroring `foundation/testing`). 020–025 import these.
- `eslint.config.js`: a net-new `no-restricted-syntax` config block scoped to
  `packages/systems/chat/src/system.ts` + `packages/systems/chat/src/model/**`
  (where the reducer lives now and lands later), banning only `Date.now`/`Math.random`/`new Date`.

## Implementation Notes

- `fast-check` added (root devDep). `foundation/testing`: `generators.ts` (coherent
  `InkStep`/story-stream arbitraries), `property.ts` (`runStream` over an ended
  `-> END` story, `assertDeterministic`, `assertInvariant`, `Predicate`/`Violation`).
- Determinism property is green over the pure stub and **rejects a planted flaky
  reducer** (`property.test.ts`).
- Purity lint: a net-new `no-restricted-syntax` block in `eslint.config.js` scoped to
  `chat/src/system.ts` + `chat/src/model/**`, banning `Date.now`/`Math.random`/`new
  Date`. Verified it fires on a planted `Date.now` and is clean otherwise.
- `@narratives/system-chat/testing` subpath (package `exports` + vitest alias):
  `predicates.ts` — `routingOwnership` (green now), `notifyOnce`, `seedExclusion`,
  `hwmMonotonic`, `forwardOnlyTime`, `receiptMonotonic` (authored; 020–025 consume).
  Time/receipt predicates forward-declare `chat/timeChanged` / `chat/receiptChanged`
  effects that 023/024 will emit.
- `routing.property.test.ts` proves the predicate green and the subpath import.
- Verified green: `tsc -b`, `lint:boundaries`, `test:rebuild` (31), `vite build`.
