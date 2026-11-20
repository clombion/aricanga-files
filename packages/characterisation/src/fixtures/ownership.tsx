/**
 * Ownership: where a root may be created, and what owner the mounting seam runs under.
 *
 * - A custom element's connectedCallback runs outside any reactive owner.
 * - Creating a memo, effect or root inside an effect callback (the apply phase, which has no owner).
 * - `runWithOwner(null, …)` as the escape hatch from an effect callback.
 */

import { createEffect, createMemo, createRoot, flush, getOwner, runWithOwner } from 'solid-js';

import { markDone, record } from '../harness';
import { errorText } from '../support';

class OwnerProbe extends HTMLElement {
  ownerAtConnect: unknown = 'not connected';

  connectedCallback(): void {
    this.ownerAtConnect = getOwner();
  }
}
customElements.define('chx-owner-probe', OwnerProbe);

/** Run `body` inside an effect's apply phase and report what it threw, if anything. */
function inEffectCallback(body: () => void): string | undefined {
  let thrown: string | undefined;
  const dispose = createRoot((disposeRoot) => {
    createEffect(
      () => 0,
      () => {
        try {
          body();
        } catch (error) {
          thrown = errorText(error);
        }
      },
    );
    return disposeRoot;
  });
  // The apply phase runs here, outside the root's body, as it does in an application.
  flush();
  dispose();
  return thrown;
}

export function run(): void {
  const probe = new OwnerProbe();
  document.body.append(probe);
  record({
    id: 'ownership/connected-callback-unowned',
    ok: probe.ownerAtConnect === null,
    threw: false,
    note: `getOwner() in connectedCallback: ${String(probe.ownerAtConnect)}`,
  });
  probe.remove();

  const memoThrown = inEffectCallback(() => {
    // oxlint-disable-next-line solid/reactivity -- the planted memo created where Solid refuses it
    createMemo(() => 1);
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
    ok: true,
    threw: rootThrown !== undefined,
    note: rootThrown === undefined ? 'createRoot in an effect callback was allowed' : `refused: ${rootThrown}`,
  });

  const detachedThrown = inEffectCallback(() => {
    runWithOwner(null, () => {
      createRoot((dispose) => {
        // oxlint-disable-next-line solid/reactivity -- the planted memo created under a detached root
        createMemo(() => 1);
        dispose();
      });
    });
  });
  record({
    id: 'ownership/run-with-owner-null-in-effect-callback',
    ok: true,
    threw: detachedThrown !== undefined,
    note:
      detachedThrown === undefined
        ? 'runWithOwner(null) + createRoot in an effect callback was allowed'
        : `refused: ${detachedThrown}`,
  });

  markDone();
}
