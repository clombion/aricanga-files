# ADR-0002: TypeScript + Lit + Vite stack

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

The POC used vanilla Web Components with hand-rolled `innerHTML` (files up to ~980
lines) and JSDoc typedefs whose "illegal states unrepresentable" goal was chased
with custom linters. The goals — embeddable, offline, accessible UI; a complex
typed simulation; agent-authored code — point to stronger structural guarantees.

## Decision

- **TypeScript** across the framework. Discriminated unions for messages, tags,
  effects, and snapshots make whole classes of the POC's linters into compile
  errors.
- **Lit** for the view layer — keeps the Web Component + Shadow DOM boundary
  (embeddable, dependency-light) while replacing manual DOM work with declarative,
  reactive templates.
- **Vite** as bundler/dev server; **Vitest** for tests.
- Module boundaries enforced by `eslint-plugin-boundaries`, replacing the
  import-graph linters.

## Consequences

- A real build toolchain is now required (the POC deliberately avoided one).
- ~60 bespoke checks collapse to types + one boundary lint + a small set of
  genuine domain validators (ink compile, tag schema, i18n parity).
- React/Svelte were rejected: they break the embed-anywhere/offline goal.
