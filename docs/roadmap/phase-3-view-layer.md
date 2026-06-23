# Phase 3 — View layer (imperative shell, rendering side)

**Labels:** `type:epic`, `area:ui`, `area:chat`, `area:phone`
**Depends on:** Phase 2 · **Contract:** ADR-0007, `phase-1-foundation-design.md`

## Goal

Render systems' view-models as Lit Web Components and execute the `Present`/`DriveInk` effects — the rendering side of the imperative shell, with chat and phone composed into a phone experience at behavioural parity with the reference.

## Context

The view is the dual of the kernel under the algebra:

- **Pure projection:** a system's `view(state, renderContext) → viewModel` is pure; `renderContext = { now, locale }` is the only world it reads (relative time, formatting).
- **Pure components:** a Lit component is `viewModel → DOM` plus `DOM-event → intent`, where an intent is a `Player` input. Components hold no domain state and never read the clock, locale, or storage directly.
- **Effect executor (the shell):** the host turns `Present` effects (`Notify`, `Typing`, `PlaySound`, `ReceiptChanged`, `TimeChanged`) into UI updates and `DriveInk` into ink-runtime calls. This is where Phase 2's emitted effects become visible behaviour.
- **Phone chrome is a system's view** (`systems/phone`), composed with chat via the runtime; lock screen, status bar, battery are its components and `Present` effects.
- **Accessibility is a per-component property** (axe-clean, keyboard-operable), plus a composed-app sweep.

## Proof / Definition of Done

Aricanga renders and plays at behavioural parity with the reference on the new stack; axe-clean; phone + chat composed via the runtime; components are pure (`viewModel → DOM`, no domain state).

## Subtasks

See [`tasks/`](tasks/README.md), task-028…039. Backbone + a11y harness first, then components (axe per component), then the sweep and the parity proof. Components consume view-models and emit intents (Player inputs); the host effect-executor renders `Present` effects.

## Non-goals

No physics (kernel is Phase 2). No new vocabularies. The render-context clock/locale are host-injected; components must not read them directly.
