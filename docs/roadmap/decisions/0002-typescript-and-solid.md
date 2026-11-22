# ADR-0002: TypeScript + Solid 2.0 + Vite stack

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

The POC used vanilla Web Components with hand-rolled `innerHTML` (files up to ~980
lines) and JSDoc typedefs whose "illegal states unrepresentable" goal was chased
with custom linters. The goals — embeddable, offline, accessible UI; a complex
typed simulation; agent-authored code — point to stronger structural guarantees.

The kernel (ADR-0003, ADR-0007) owns every piece of game state and hands the view
one snapshot per step. The view layer therefore has a narrow job: map a snapshot
to view-models, render them, and turn DOM events into `Player` inputs. What it
needs from a UI library is cheap, keyed updates from a replaced snapshot, typed
component contracts that a game can override at its composition root, and a
Shadow DOM boundary so an experience embeds anywhere.

## Decision

- **TypeScript** across the framework. Discriminated unions for messages, tags,
  effects and snapshots turn whole classes of the POC's linters into compile errors.
- **Solid 2.0** for the view layer (`solid-js`, `@solidjs/web`), compiled by the
  native Solid compiler through `@solidjs/vite-plugin` (no Babel). The exact
  versions are pinned; a Solid upgrade reruns the characterisation suite
  (`packages/characterisation`) in Chromium, Firefox and WebKit before it lands.
  - Each mounted experience is a custom element that renders one Solid root into
    its own shadow root, so the embed boundary stays a Web Component.
  - Components are typed functions of a single `vm` prop. A system's view package
    exports its view-model types and a `Parts` type; a game swaps a part only at
    its composition root, and the compiler checks the replacement.
  - Look and feel are design tokens (CSS custom properties) on that shadow root.
  - Solid's runtime model as this project relies on it — mounting and disposal,
    the snapshot adapter, error boundaries, measurement, events, CSP — is
    ADR-0008, written from the characterisation results.
- **Vite** as bundler and dev server; **Vitest** for unit tests; **Playwright** for
  real-browser tests in Chromium, Firefox and WebKit.
- **Module boundaries** are enforced by a lint, replacing the import-graph
  linters. Code under `packages/foundation` and `packages/systems/*/src/model`
  imports nothing from `solid-js` or `@solidjs/*`.
- **Accessible primitives:** Kobalte once a release accepts the installed
  `solid-js` without overrides; until then the accessible parts are built here.

## Why Solid

- **Snapshot in, fine-grained updates out.** A store reconciled by id against
  each new view-model touches only the nodes whose data changed; components run
  once, with no virtual-DOM diff on every step.
- **Typed component contracts.** JSX is type-checked, so the `Parts` override
  seam is held by the compiler. `Lit`'s templates are tagged strings that need a
  separate analyser to type-check bindings.
- **Small runtime, real DOM.** Templates compile to DOM creation code with no
  `eval`, which keeps the strict CSP (`script-src 'self'; style-src 'self'`)
  reachable.

React, Svelte and `Lit` all bundle for offline use and can sit behind a custom
element (Svelte compiles to custom elements directly), so embedding and offline
play do not separate them. The deciding factors are the three above: React
re-renders through a virtual DOM and `Lit`'s bindings are untyped, while Svelte is
the closest alternative and loses on the typed, overridable component contract.

## Consequences

- A real build toolchain is required (the POC deliberately avoided one).
- ~60 bespoke checks collapse to types, one boundary lint and a small set of
  genuine domain validators (ink compile, tag schema, i18n parity).
- Solid 2.0 is new; its runtime claims are tested rather than assumed, and a
  claim a test contradicts is recorded in ADR-0008 with its evidence.
- Lint and format: oxlint owns `.ts`/`.tsx` (type-aware, with
  `eslint-plugin-solid`'s v2-strict rules), stylelint lints CSS, a harness check
  holds JSON, and oxfmt formats every held TypeScript, CSS and JSON file. TypeScript stays on 6.x until the boundary lint runs on oxlint with
  fixture parity; then it moves to 7.
