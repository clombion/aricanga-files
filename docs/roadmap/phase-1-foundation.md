# Phase 1 — Foundation contracts (designed against two vocabularies)

**Labels:** `type:epic`, `area:foundation`
**Blocked by:** Phase 0 · **Blocks:** Phases 2, 3, 4, 5, 6

## Risk retired

The foundation is secretly chat-shaped.

## Goal

Define the seams only:

- `Snapshot<TSystems>` — keyed map of opaque per-system state slices (one or more).
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

## Design

See [`phase-1-foundation-design.md`](phase-1-foundation-design.md) for the
concrete contract shapes, and [`decisions/`](decisions/) for the architectural
decision records (ADR-0001…0004).

## Subtasks

See [`tasks/`](tasks/README.md) for the full task files with acceptance criteria.

- [ ] task-008 — Kernel and snapshot contracts
- [ ] task-009 — Open effect channel
- [ ] task-010 — Single event bus and DomainEvent envelope
- [ ] task-011 — System interface
- [ ] task-016 — Multi-system router contract
- [ ] task-012 — Composition root
- [ ] task-013 — Chat system stub
- [ ] task-014 — Cards system stub
- [ ] task-015 — Two-vocabulary proof

## Non-goals

No physics implementation, no real components — contracts + stubs only.
