# ADR-0007: System framework — a closed Input/Effect algebra over a generic runtime

- **Status:** Accepted
- **Date:** 2026-06-19

## Context

The framework runs ink-driven narrative systems (chat, cards, and future vocabularies). Each system must be deterministic, unit-testable without a DOM or network, and composable into experiences. For that to hold, the complete set of ways a system interacts with the impure world — the ink engine, timers, network, storage, the screen, the player — must be *knowable and enforceable*, not discovered piecemeal.

## Decision

**Every system is a pure reducer described by two closed algebraic data types.**

1. A system is two pure functions:
   - `reduce(state, input) → (state, effects)`
   - `view(state, renderContext) → viewModel`

   Neither performs I/O, reads the clock, or uses randomness. Same inputs always produce the same outputs.

2. A system's entire boundary with the world is two closed sum types:
   - `Input` — everything that can drive `reduce`.
   - `Effect` — everything `reduce` asks the world to do (returned as data; the host executes it).

   Because the reducer is pure, these two types *are* the complete boundary, by construction — a pure function has no other channel to the world. Completeness of the boundary therefore reduces to "are `Input` and `Effect` total?", a finite, compiler-checkable question.

3. **`Input` is closed by source:** `Story(step)` · `Player(command)` · `Resume(completion)` — one per suspending effect · `Lifecycle(init | reset)`.
   **`Effect` is closed by host capability:** `DriveInk` · `Schedule` · `Fetch` · `Present` · `Persist`.

4. **All impure resources are host-owned.** The ink Story (and per-conversation snapshots), the clock, storage, and the i18n/data lookups live in the host. `state` holds no engine serialization and no wall-clock; ids are seeded, displayed time is simulation-derived. `view` reads the world only through a host-injected `renderContext` (`{ now, locale }`).

5. **The foundation provides a generic, system-agnostic runtime** (a Sans-IO / functional-core–imperative-shell host loop) that drives any system: it pumps the system while a pure `status(state)` predicate (combined with host-owned ink readiness) reports ready, executes returned effects, and feeds the matching `Resume` inputs back. Routing, composition, and the view shell are shared across systems.

## Consequences

- A system's boundary completeness is a decidable check, enforced by exhaustive handling of `Input`/`Effect` (a new interaction does not compile until it is a constructor).
- Determinism and purity are lint- and test-enforced: no `Date.now`/`Math.random`/locale in `reduce`; a run-twice deep-equality invariant; a golden recorded as the `Input→Effect`+`state` stream.
- Systems are uniform. chat, cards, and future systems differ only in their `Input`/`Effect` membership and `reduce` body; the runtime, routing, composition, and view shell are reused unchanged.
- An experience is a composition: chosen systems + a host shell (effect executor + render context) + injected resources (story, i18n/data, config).

## Applies to

This is the framework's core contract. It governs the foundation runtime and the `System` interface (see `phase-1-foundation-design.md`), every system's design (chat, cards), the view layer (`view` purity + intents-as-inputs), experiences (composition), and the standing CI guards (exhaustiveness, purity, determinism).
