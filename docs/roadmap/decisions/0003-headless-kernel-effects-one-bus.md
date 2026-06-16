# ADR-0003: Headless kernel, open effect channel, single event bus

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

In the POC the simulation physics (routing, deferral, notifications, HWM, time,
receipts) was smeared across an XState machine, helper modules, the controller,
and DOM components. Side effects travelled over four mechanisms: two
`EventTarget`s, a global `EventBus` singleton, XState, and ad-hoc `CustomEvent`s
(plus `console.log` placeholders). State was split between ink and XState context.

## Decision

- **Headless kernel:** the physics is a pure `reduce(state, chunk, ctx) → { state,
  effects }` with no DOM and no event bus inside it.
- **Effects as data:** side effects are returned as an open, extensible
  `Effect<K, P>` list; the host executes them. Foundation defines only
  `FoundationEffect`; each system contributes its own effect kinds without
  foundation knowing about them.
- **One event bus, three roles:** rendering is `snapshot → deriveViewModel → Lit`;
  effects are the host's to-do list; the single `EventBus` carries `DomainEvent`s
  for analytics + cross-system coordination only (fed by `foundation/emit`).
- **One snapshot** owns all save state (ink + system slice), versioned for
  migration.

## Consequences

- The crown-jewel physics becomes unit-testable and fuzzable in Node; the POC's
  vacuous invariant tests are replaced by real property tests (Phase 2).
- No split-brain state; no "which bus?" ambiguity.
- Analytics is event-sourced for free as a bus subscriber.
