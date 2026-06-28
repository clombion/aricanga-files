# Phase 2 — Chat system kernel

**Labels:** `type:epic`, `area:chat`, `area:foundation`
**Depends on:** Phase 1 · **Contract:** ADR-0007, `phase-1-foundation-design.md`

## Goal

Deliver the chat system as a pure reducer over a closed `Input`/`Effect` algebra, running on the foundation's generic runtime, reproducing the conversation simulation physics deterministically and headlessly.

## Context

This phase establishes two things at once: the **generic foundation runtime** that every system uses (ADR-0007), and the **chat system** as its first full instance. The runtime, `Input`/`Effect` shape, `status` predicate, host loop, and purity rules are foundation-level and reused by cards (Phase 6) and future systems; chat supplies the concrete membership and the `reduce` body.

The chat kernel interprets ink output and player commands into chat state + effects. Its boundary is fixed by the algebra:

- **Input:** `Story(InkStep)`, `Player(Open|Close|Choose)`, `Resume(CommitFired|DataArrived|StoryLoaded|Restored)`, `Lifecycle(Init|Reset)`.
- **Effect:** `DriveInk(Choose|Goto|SaveSnap|LoadSnap)`, `Schedule(Commit)`, `Fetch(RequestData)`, `Present(Notify|Typing|PlaySound|ReceiptChanged|TimeChanged)`, `Persist(Save)`.
- **State** holds message history, deferred queues, read cursors, notified set, current view, the in-flight buffer (with `bufferGeneration`), labelled messages, simulation time `{day, minute}`. No wall-clock, no ink serialization (per-conversation ink snapshots are host-owned).
- **Externals:** `name`/`data` resolve into `InkStep.text` via host-injected deterministic lookups; `delay_next`/`play_sound`/`advance_day`/`request_data` arrive as `InkStep.externalCalls` and are interpreted by `reduce`.

The physics is the body of `reduce`, interpreting each input per `docs/concepts/simulation-physics.md`: tag/`targetChat` routing; first-background-message immediate then deferral; notify-once-per-session with an atomic notify effect; HWM read cursor (set-once, sentinel) and unread boundary; forward-only simulation time; receipt upgrade (backward-walk, unified for live and seed load); seeds (no time, no notify, first-visit); message grouping derivation (view-side, keyed on simulation time). Notification is emitted by the kernel atomically with the notified-set update.

## Proof / Definition of Done

The chat kernel reproduces a reviewed, deterministic golden of Aricanga's `Input→Effect`+`state` stream; the invariant and regression suites pass; `reduce` is provably pure (lint + run-twice equality); `Input`/`Effect` handling is exhaustive (compiles).

## Subtasks

See [`tasks/`](tasks/README.md). TDD-led: contract + runtime + suites first (red), then the physics body.

- [x] task-040 — Foundation algebra contract (`Input`/`Effect`/`InkStep` types, `reduce(input)`, `status`, drop `ctx.now`, `RenderContext`)
- [x] task-041 — Generic Sans-IO host runtime (pump-gate, effect executor, resume handshakes, validation, commit epoch)
- [x] task-062 — Reshape the merged Phase 1 foundation to the algebra (migrate `System`/`Snapshot`/router/composition root + retire the standalone executor)
- [ ] task-017 — Kernel test harness and fixtures (host-loop driver, fixed seed, canonical golden capture)
- [ ] task-018 — Simulation-physics invariant suite (property-based) + purity/determinism/exhaustiveness invariants
- [ ] task-019 — BUG-HISTORY regression suite
- [ ] task-020 — Message routing and targetChat + buffer/command loop
- [ ] task-021 — Deferred queue and emergent (atomic) notifications
- [ ] task-022 — HWM read cursors and unread boundary
- [ ] task-023 — Forward-only simulation time
- [ ] task-024 — Read receipts (unified backward-walk)
- [ ] task-025 — Seeds
- [ ] task-026 — Message grouping derivation (view-side, simulation-time keyed)
- [ ] task-027 — Golden replay of Aricanga (phase proof)

## Non-goals

No rendering. Externals' value-returning lookups (`name`/`data`) are injected fixtures; the view layer (Phase 3) executes `Present` effects and renders view-models.
