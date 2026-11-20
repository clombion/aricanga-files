# Phase 3 — View layer (imperative shell, rendering side)

**Labels:** `type:epic`, `area:ui`, `area:chat`, `area:phone`
**Depends on:** Phase 2 · **Contract:** ADR-0002, ADR-0007, ADR-0009, `phase-1-foundation-design.md`

## Risk retired

A Solid 2.0 view over the kernel's snapshots can't reproduce the POC's UI and
accessibility.

## Goal

Render systems' view-models with Solid 2.0 and execute the `Present`/`DriveInk`
effects — the rendering side of the imperative shell — with chat and phone
composed into a phone experience at behavioural parity with the reference.

## Context

The view is the dual of the kernel under the algebra:

- **Pure projection:** a system's `view(state, renderContext) → viewModel` is
  pure; `renderContext = { now, locale }` is the only world it reads.
- **Snapshot adapter:** one Solid store per mounted experience. The host calls
  `apply(snapshot)` outside any reactive scope after each `send`/`step`, and the
  store reconciles the new view-models by id, so only changed nodes update.
- **Pure parts:** a part is a typed function of one `vm` prop, `vm → DOM` plus
  `DOM event → intent`, where an intent is a `Player` input sent through
  `experience.send`. Parts hold no domain state, never read the clock, locale or
  storage, and are synchronous.
- **Effect executor (the shell):** the host turns `Present` effects (`Notify`,
  `Typing`, `PlaySound`, `ReceiptChanged`) into UI actions and `DriveInk` into
  ink-runtime calls. Everything renderable is in `view()`; side effects stay effects.
- **Mounting:** each experience is a custom element that renders one Solid root
  into its own shadow root in `connectedCallback` and disposes it in
  `disconnectedCallback`.
- **Phone chrome is a system's view** (`systems/phone`), composed with chat via
  the runtime; lock screen, status bar and battery are its parts.
- **Accessibility is a per-part property** (axe-clean, keyboard-operable), plus a
  composed-app sweep.

### Three layers of modularity, each with an enforced rule

| Layer | What varies | Rule |
|---|---|---|
| Mechanics | kernel systems | nothing under `packages/foundation` or `packages/systems/*/src/model` imports `solid-js` or `@solidjs/*` |
| Parts | typed, replaceable components | each system view package exports its view-model types and a `Parts` type; a game overrides parts only at its composition root, checked by the compiler |
| Feel | design tokens | CSS custom properties on the experience's shadow root; no `style` prop |

## Steps (gated)

1. **Characterisation (hard gate).** Every claim about Solid's runtime that the
   view layer relies on is a real-browser test against the pinned versions, in
   Chromium, Firefox and WebKit, desktop and mobile emulation. ADR-0009 is
   written from the results. A contradicted claim changes the design. (task-063)
2. **Toolchain.** oxlint for `.ts`/`.tsx` with `eslint-plugin-solid` v2-strict,
   Biome for CSS and JSON, oxfmt for formatting, under the correctness harness of
   ADR-0006; TypeScript 7 once the boundary lint has fixture parity on oxlint.
   (task-064)
3. **View layer.** Adapter, mount and shell first, with the project lint rules
   (each with a must-fire and a must-stay-clean fixture); then parts with axe per
   part; then the sweep and the parity proof. (task-003, task-028…039)

## Proof / Definition of Done

- Aricanga's golden replay matches the reference (task-027) and the composed
  experience plays at behavioural parity.
- The a11y suite passes.
- The whole suite, including CSP, characterisation and performance, passes in
  Chromium, Firefox and WebKit; CI fails on a performance regression over 25 %.
- A second experience overrides at least one part and its tokens with no change
  to a system package.

## Subtasks

See [`tasks/`](tasks/README.md): task-063, task-064, task-003, task-028…039.

## Non-goals

No physics (kernel is Phase 2). No new vocabularies. The render-context clock
and locale are host-injected; parts never read them directly.
