/**
 * Ownership: where a root may be created, and what owner the mounting seam runs under.
 *
 * - A custom element's connectedCallback runs outside any reactive owner.
 * - Creating a memo, effect or root inside an effect callback (the apply phase, which has no owner).
 * - `runWithOwner(null, …)` as the escape hatch from an effect callback.
 */

import { createEffect, createMemo, createRoot, flush, getOwner, runWithOwner } from 'solid-js';
import { markDone, record } from '#src/harness';
import { errorText } from '#src/support';

/** The value the planted memos compute; what it is does not matter, only where the memo is created. */
const PLANTED_VALUE = 'planted';

/** The source the effect tracks; it never changes, the apply phase runs once on the first flush. */
const UNCHANGING = 'unchanging';

/**
 * The owner a custom element's connectedCallback runs under.
 * @returns {unknown} What `getOwner()` returned there.
 */
function ownerAtConnect(): unknown {
  class OwnerProbe extends HTMLElement {
    public ownerAtConnect: unknown = 'not connected';

    public connectedCallback(): void {
      this.ownerAtConnect = getOwner();
    }
  }
  customElements.define('chx-owner-probe', OwnerProbe);
  const probe = new OwnerProbe();
  document.body.append(probe);
  probe.remove();
  return probe.ownerAtConnect;
}

/**
 * Run `body` inside an effect's apply phase and report what it threw, if anything.
 * @param {Function} body The code to run there.
 * @returns {string | undefined} The thrown message, or undefined when nothing threw.
 */
function inEffectCallback(body: () => void): string | undefined {
  const outcome: { thrown?: string } = {};
  const dispose = createRoot((disposeRoot) => {
    createEffect(
      () => UNCHANGING,
      () => {
        try {
          body();
        } catch (error) {
          outcome.thrown = errorText(error);
        }
      },
    );
    return disposeRoot;
  });
  // The apply phase runs here, outside the root's body, as it does in an application.
  flush();
  dispose();
  return outcome.thrown;
}

/** Record whether a memo, a root and a detached root are refused in an effect's apply phase. */
function recordEffectCallbackRefusals(): void {
  const memoThrown = inEffectCallback(() => {
    // oxlint-disable-next-line solid/reactivity -- the planted memo created where Solid refuses it
    createMemo(() => PLANTED_VALUE);
  });
  record({
    id: 'ownership/memo-in-effect-callback-refused',
    ok: memoThrown !== undefined,
    threw: memoThrown !== undefined,
    ...(memoThrown === undefined ? { note: 'a memo created in an effect callback did not throw' } : { error: memoThrown }),
  });
  const rootThrown = inEffectCallback(() => {
    createRoot((dispose) => {
      dispose();
    });
  });
  record({
    id: 'ownership/root-in-effect-callback',
    note: rootThrown === undefined ? 'createRoot in an effect callback was allowed' : `refused: ${rootThrown}`,
    ok: true,
    threw: rootThrown !== undefined,
  });
}

/** Record whether a root detached with `runWithOwner(null, …)` escapes the apply-phase refusal. */
function recordDetachedRoot(): void {
  const detachedThrown = inEffectCallback(() => {
    // Solid's own API names "no owner" with null, so the planted escape passes it.
    // oxlint-disable-next-line unicorn/no-null -- runWithOwner takes null for "no owner"; the fixture plants that call
    runWithOwner(null, () => {
      createRoot((dispose) => {
        // oxlint-disable-next-line solid/reactivity -- the planted memo created under a detached root
        createMemo(() => PLANTED_VALUE);
        dispose();
      });
    });
  });
  record({
    id: 'ownership/run-with-owner-null-in-effect-callback',
    note:
      detachedThrown === undefined
        ? 'runWithOwner(null) + createRoot in an effect callback was allowed'
        : `refused: ${detachedThrown}`,
    ok: true,
    threw: detachedThrown !== undefined,
  });
}

/** Record the owner the mounting seam runs under and each apply-phase refusal. */
function run(): void {
  const owner = ownerAtConnect();
  record({
    id: 'ownership/connected-callback-unowned',
    note: `getOwner() in connectedCallback: ${String(owner)}`,
    // Solid reports "no owner" as null.
    ok: owner === null,
    threw: false,
  });
  recordEffectCallbackRefusals();
  recordDetachedRoot();
  markDone();
}

export { run };
