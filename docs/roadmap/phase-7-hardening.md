# Phase 7 — Hardening & standing guards

**Labels:** `type:epic`, `area:tooling`
**Depends on:** Phases 5, 6 · **Contract:** ADR-0007

## Goal

Make the algebra's guarantees permanent CI gates, finish the cross-cutting concerns, and retire the reference.

## Context

The properties that make the architecture sound become standing, enforced gates rather than one-off checks: `Input`/`Effect` exhaustiveness (compile), reducer purity (no `Date.now`/`Math.random`/locale), determinism (run-twice deep-equal + golden), and layered boundaries (foundation ← systems ← experiences). Analytics is an event-sourced sink over the effect stream — no separate transport. Save state is versioned with migrations.

## Proof / Definition of Done

All systems and experiences pass the standing guards on one foundation; analytics derives from the effect stream; save migrations exist; the reference branch is deleted.

## Subtasks

- [ ] [#21](https://github.com/clombion/aricanga-files/issues/21) — Standing CI guards: exhaustiveness, purity lint, determinism, boundary lint, a11y
- [ ] [#17](https://github.com/clombion/aricanga-files/issues/17) — Event-sourced analytics sink over the `Effect` stream
- [ ] [#18](https://github.com/clombion/aricanga-files/issues/18) — Save snapshot versioning + migrations
- [ ] [#19](https://github.com/clombion/aricanga-files/issues/19) — Docs consolidation to the algebra contract
- [ ] [#50](https://github.com/clombion/aricanga-files/issues/50) — Delete the POC reference branch

## Non-goals

No new features — consolidation and enforcement only.
