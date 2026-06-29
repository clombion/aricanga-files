---
id: task-017
title: Kernel test harness and fixtures
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-28
labels: [foundation, testing, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-040, task-041, task-062]
parent_task_id:
---

## Description

The headless test substrate every Phase 2 kernel test stands on, built over the
generic `Runtime` (it is not a second driver). It captures the kernel-observable
`Input→Effect`+`state` stream through a named reduce-trace observer on the runtime,
settles suspending effects with a deterministic drain, and records a canonical
golden. The complete, ordered, input-correlated stream is only visible at the
reduce boundary — so capture happens there, via a first-class observability port
(the same seam task-018 determinism and task-058 analytics consume), never by
tapping individual host sinks.

## Acceptance Criteria

- [ ] #1 The runtime exposes a named `ReduceObserver` port (a peer of `Host`, not a new `Input`/`Effect`); the harness records an immutable `{ systemId, input, effects, state }` per reduction — the whole stream, not one effect family
- [ ] #2 `runFixture` drives a system over a compiled ink fixture headlessly (Node, no DOM, under `vitest run`) and returns the trace, the full effect list, the final snapshot, and a `view` accessor; ids are seeded and deterministic (no clock — story time is simulation-derived)
- [ ] #3 A deterministic drain (synchronous fake scheduler + an awaitable fake fetch firing in declared order) settles suspending effects; the golden is taken post-drain, so the same fixture + seed yields an identical trace
- [ ] #4 A synthetic multi-family fixture system (emits every effect family; maps a choose-command to `drive-ink`) proves full-stream capture and choice-driving independent of any vocabulary
- [ ] #5 Chat ink fixtures (single chat, cross-chat, choices) drive realistic traces through the harness
- [ ] #6 The golden is a canonical sorted-key serialization (with `undefined`/absent optional fields canonicalized consistently); a changed stream fails the file-snapshot diff
- [ ] #7 The harness is exported from `@narratives/foundation/testing`, imports no concrete system, and is consumed by chat (and later cards) tests

## Tests

- **Classes:** guard (meta — this task builds the harness) (+ behaviour for determinism)
- guard/smoke (pre-commit): #1, #2, #4 — `runFixture` replays the synthetic fixture and returns a multi-family trace + snapshot, headless
- behaviour/example (pre-commit): #3 — same fixture + same seed ⇒ identical drained trace
- guard/tripwire (CI): #6 — a perturbed reducer fails the golden file diff
- constraint/architecture (pre-commit): #7 — chat tests import `@narratives/foundation/testing`; the harness imports no concrete system

> Carve-out: harness task — proven by replaying fixtures deterministically.
> Scope: multi-family / suspend / choice goldens over *real* systems land with the
> physics (020–026) and the Aricanga replay (027); 017 proves the mechanism plus
> the chat stubs' (Present-only) traces.

## Implementation Plan

- `host/runtime.ts`: add a named `ReduceObserver` port (optional, a peer of `Host`);
  fire it in `deliver()` with the immutable, canonical-captured record.
- `packages/foundation/src/testing/`: `runFixture` + the deterministic drain fakes +
  the synthetic multi-family fixture system + the canonical sorted-key serializer +
  the golden helper (awaited `toMatchFileSnapshot` over the serialized string).
- Export as `@narratives/foundation/testing` (package `exports` subpath + a
  `vitest.rebuild.config` alias + tsconfig inclusion).
- Chat fixtures under `packages/systems/chat/test/fixtures/*.ink`, driven via the harness.

## Implementation Notes

- Runtime seam: `sim/trace.ts` (`ReduceRecord`/`ReduceObserver`); `RuntimeConfig.observer`
  fired in `deliver()` with `{systemId, input, effects, state}`. Adds no Input/Effect.
- Harness: `packages/foundation/src/testing/` exported as `@narratives/foundation/testing`
  (package `exports` subpath → `dist/testing` + a vitest alias ordered before the bare
  specifier). `runFixture` drives the *real* runtime with deterministic host fakes (FIFO
  scheduler, declared-order fetch), a recording observer that `structuredClone`s each
  record, and an explicit `drain()` that settles timers + fetch microtasks before the
  trace is read.
- `fixture-system.ts` is the synthetic multi-family system (every effect family +
  choose→`driveInk`); `serialize.ts` is the canonical sorted-key serializer
  (`undefined`→`null`). Golden via awaited `toMatchFileSnapshot` over the string.
- Chat fixtures at `packages/systems/chat/test/fixtures/*.ink` prove the shared import
  path; chat traces are Present-only (real physics/choices → 020–026).
- Verified green: `tsc -b`, `lint:boundaries`, `test:rebuild` (28), `vite build`.
