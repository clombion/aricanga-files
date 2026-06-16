# Phase 1 — Foundation contracts (designed against two vocabularies)

**Labels:** `type:epic`, `area:foundation`
**Blocked by:** Phase 0 · **Blocks:** Phases 2, 3, 4, 5, 6

## Risk retired

The foundation is secretly chat-shaped.

## Goal

Define the seams only:

- `Snapshot<TSystemState>` — generic over a system-owned state slice.
- An open/extensible `Effect` channel (not a fixed enum).
- The pure kernel signature `reduce(state, chunk) → {state, effects}`.
- The single event bus.
- The `System` interface — tags, reducer slice, view-model deriver, component
  registration.
- The composition root that replaces the global singletons.

Write **chat *and* cards stubs** against this interface to force the generics
honest now, before any physics exists.

## Proof / Definition of Done

Foundation types compile; two stub systems wire through one composition root;
switching between them touches zero foundation code.

## Subtasks

- [ ] (added when we break down this phase)

## Non-goals

No physics implementation, no real components — contracts + stubs only.
