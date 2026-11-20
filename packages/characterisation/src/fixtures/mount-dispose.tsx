/**
 * The mounting contract: one Solid root per experience, mounted into the custom element's shadow root
 * in connectedCallback, disposed in disconnectedCallback, with per-part cleanup released on dispose.
 */

import { markDone, record } from '#src/harness';
import type { JSX } from '@solidjs/web';
import { onSettled } from 'solid-js';
import { render } from '@solidjs/web';
import { settle } from '#src/support';

/** A count a closure owns: `add` raises it by one and `count` reads it. */
interface Counter {
  readonly add: () => void;
  readonly count: () => number;
}

/** A part run exactly once, and a cleanup released exactly once. */
const ONCE = 1;

/**
 * A fresh count, starting at zero.
 * @returns {Counter} The counter.
 */
function counter(): Counter {
  let value = 0;
  return {
    add: (): void => {
      value += ONCE;
    },
    count: (): number => value,
  };
}

/**
 * A custom element class that mounts one part into its shadow root, counting the part's lifecycle.
 * @param {Counter} setups Raised when the part's settled setup runs.
 * @param {Counter} cleanups Raised when the cleanup that setup returned runs.
 * @returns {CustomElementConstructor} The element class.
 */
function hostClass(setups: Counter, cleanups: Counter): CustomElementConstructor {
  function Bubble(props: Readonly<{ vm: Readonly<{ text: string }> }>): JSX.Element {
    // `onSettled` is the 2.0 component lifecycle primitive (it replaces onMount and onCleanup):
    // setup runs after the first settle, and the cleanup it returns runs on owner disposal.
    onSettled(() => {
      setups.add();
      return cleanups.add;
    });
    return <p part="bubble">{props.vm.text}</p>;
  }

  return class ChxHost extends HTMLElement {
    private dispose: (() => void) | undefined = undefined;

    public connectedCallback(): void {
      const root = this.attachShadow({ mode: 'open' });
      // `render` returns the owner's disposer; it is kept for disconnectedCallback.
      this.dispose = render(() => <Bubble vm={{ text: 'hello' }} />, root);
    }

    public disconnectedCallback(): void {
      this.dispose?.();
      this.dispose = undefined;
    }
  };
}

/**
 * Connect a counted host element, then record what it rendered and how often its part set up.
 * @param {Counter} setups Raised when the part's settled setup runs.
 * @param {Counter} cleanups Raised when the cleanup that setup returned runs.
 * @returns {Promise<HTMLElement>} The connected element.
 */
async function mounted(setups: Counter, cleanups: Counter): Promise<HTMLElement> {
  customElements.define('chx-host', hostClass(setups, cleanups));
  const host = document.createElement('chx-host');
  document.querySelector('#app')?.append(host);
  await settle();
  const bubble = host.shadowRoot?.querySelector('p[part="bubble"]');
  record({
    id: 'mount/renders-into-shadow-root',
    note: `shadow html: ${host.shadowRoot?.innerHTML ?? '<none>'}`,
    ok: bubble?.textContent === 'hello',
    threw: false,
  });
  record({ id: 'mount/setup-ran-once', note: `setupRuns=${setups.count()}`, ok: setups.count() === ONCE, threw: false });
  return host;
}

/** Mount the element, read it, disconnect it, and record each lifecycle count. */
async function run(): Promise<void> {
  const setups = counter();
  const cleanups = counter();
  const host = await mounted(setups, cleanups);
  host.remove();
  await settle();
  record({ id: 'mount/dispose-runs-cleanup-once', note: `cleanupRuns=${cleanups.count()}`, ok: cleanups.count() === ONCE, threw: false });
  markDone();
}

export { run };
