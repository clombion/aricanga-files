# ADR-0008: The Solid 2.0 runtime model of the view layer

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

ADR-0002 chose Solid 2.0 for the view layer. Solid 2.0 shipped days before the
view layer was designed, and its runtime differs from 1.x in exactly the
surfaces the view layer leans on: ownership, stores, error boundaries,
scheduling and the compiled DOM. A claim about how it behaves at run time is a
test, not a sentence. This record is written from the characterisation suite
(`packages/characterisation`), which runs one fixture per claim in a dev build
(so Solid's diagnostics print) and pins every observation as an assertion.

Evidence: solid-js 2.0.3, @solidjs/web 2.0.3, @solidjs/compiler 2.0.2,
@solidjs/vite-plugin 3.0.1; Playwright 1.65.1 driving Chromium 159, Firefox
159 and WebKit 27.2, desktop and mobile emulation (Pixel 7, iPhone 14). Every
observation below held in every engine unless the row says otherwise. A Solid
upgrade reruns the suite before it lands.

## Decision

### Mounting and ownership

- Each experience is a custom element. Its `connectedCallback` runs with no
  reactive owner (`getOwner()` is `null`); it renders one root into its own
  shadow root with `render()` and keeps the disposer, and its
  `disconnectedCallback` calls it. A part's `onSettled` setup runs once after
  the first settle and the cleanup it returns runs once on dispose.
- No root, memo or effect is created from an effect's apply phase. Solid
  refuses each with `PRIMITIVE_IN_EFFECT_CALLBACK`, and so it refuses a root
  detached with `runWithOwner(null, …)` there too: detaching is no way out of
  the rule. Roots are made in `connectedCallback` only.

### The snapshot adapter

- One store per mounted experience. The host applies each new snapshot after
  `send`/`step`, from outside any reactive scope, with
  `setStore(draft => { reconcile(next, 'id')(draft.items) })`. Reconciling by
  id keeps the DOM nodes of every item whose id persists, a changed field
  updates in place, and applying from a timer works the same way.
- A write from a component body or a memo throws
  `REACTIVE_WRITE_IN_OWNED_SCOPE` in dev. Writes come from the adapter, and the lint
  `store-owner` holds `createStore`/`reconcile` to its module.
- A store's draft respects `readonly`, so the store's internal state type is
  writable while the view-model types parts receive stay readonly.

### Parts are synchronous

- An async read inside a part outside `<Loading>` does not throw: the part
  renders nothing while the value is pending, and dev warns
  `ASYNC_OUTSIDE_LOADING_BOUNDARY`. A part is therefore synchronous (lint
  `sync-parts`); anything asynchronous is a kernel effect the host executes,
  and its result arrives as the next snapshot.

### The failure model

- An `<Errored>` boundary per part contains that part's throw: its fallback
  renders, and its siblings keep rendering.
- No `onSettled` cleanup runs for the throwing branch. A part must not hold a
  resource it releases only in cleanup; resources are the host's.
- A throw no boundary contains propagates to the writer: the `flush()` that
  applied the snapshot throws it. Reactivity then halts (`REACTIVITY_HALTED`)
  and later updates render nothing. The mount therefore wraps every part in a
  boundary and the experience's root in one more.

### Measurement

- Reads lag writes until `flush()`. The host applies a snapshot, calls
  `flush()`, and only then reads layout. In an effect's apply phase `flush()`
  is a no-op that warns `FLUSH_IN_EFFECT_CALLBACK`; in `onSettled` it throws.
  Layout work runs in the host after its own `flush()`, never in an effect.

### Events

- Delegated handlers (`onClick`) fire inside a shadow root on real input. A
  synthetic `dispatchEvent` of a non-bubbling event never reaches them, so
  part tests drive real interaction through Playwright, never a synthetic
  dispatch.

### Properties and props

- `value`, `checked` and `selected` bound to an expression set DOM
  properties, not attributes; `defaultValue` sets only the initial value and
  leaves what the user typed. A bound one belongs only on an element that
  handles its change (lint `controlled`).
- A part takes one `vm` prop and reads it through `props`. A destructured
  `vm` follows a field change on a store proxy but never sees a new `vm`
  object, and dev warns `STRICT_READ_UNTRACKED` (lint `vm-prop`, and
  eslint-plugin-solid's `no-destructure`).

### CSP

- The experiences ship under `script-src 'self'; style-src 'self'`. The
  `style` prop makes the compiled code write a `style` attribute, which every
  engine reports as a `style-src-attr` violation. The engines then differ:
  Firefox drops the style, while Chromium and WebKit report the violation and
  apply it anyway, so a style prop looks right in Chromium and is broken in
  Firefox. The `style` prop is banned (lint `style-prop`). Dynamic style goes
  through a class, or through a ref that writes CSSOM
  (`element.style.setProperty`), which applies in every engine with no
  violation.

### Performance

- The suite renders 1,000 messages and applies 100 snapshot updates, the
  fastest of nine runs after two warm-ups, in each project. A run more than
  25 % over the project's committed baseline fails. The baseline records the
  slowest fastest-of-nine over three runs (`pnpm run characterise:baseline`).
  The minimum is the statistic: a median at these magnitudes (20 to 60 ms)
  flaked past 25 % on scheduler noise alone.

## Consequences

- Solid's diagnostics are dev-only: a production build does not throw for an
  owned write or a primitive in an effect. The lint rules and this suite are
  the guards, and the suite always runs a dev build.
- One brief claim was wrong: jsx-a11y's `label-has-associated-control` has no
  setting for Solid's `for`, and flags `<label for>` as unassociated. Label
  association is the project rule `labels`, and that jsx-a11y rule stays off.
- Each observation is pinned by a spec, so a Solid upgrade that changes one
  fails in the engine where it changed, and this record is revised from the
  new evidence.
