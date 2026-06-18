# ADR-0001: Greenfield, risk-ordered rebuild

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

The current codebase is a POC that proved the core ideas (ink-driven physics,
layered vocabulary, writer/engineer split) but exposed pitfalls: an
entangled simulation/DOM, side effects scattered across four communication
mechanisms, global singletons, untyped contracts policed by ~60 bespoke linters,
and a "composable systems" boundary that was never exercised twice. There are no
production users.

## Decision

Rebuild from scratch on a new branch rather than refactor in place. Keep the POC
as a **read-only reference** (a behavioral oracle), deleted at the end. Sequence
the build by **risk retirement** — each phase kills one named risk and has a
concrete proof — rather than building the whole ideal big-bang.

## Consequences

- No Strangler-Fig migration ceremony; the old code is never wired into the new.
- The scariest unknown (is the foundation genuinely vocabulary-agnostic?) is
  surfaced first (Phase 1) and confirmed last (Phase 6), not discovered after the
  edifice is built.
- Content (ink/TOML/assets) carries over; only code is rewritten.
