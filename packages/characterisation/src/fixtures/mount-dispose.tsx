import { render } from '@solidjs/web';
import { onSettled } from 'solid-js';
import { markDone, record } from '../harness';

// Proves the brief's mounting contract: one Solid root per experience, mounted
// into the custom element's shadow root in connectedCallback, disposed in
// disconnectedCallback, with per-part cleanup released on dispose.

let setupRuns = 0;
let cleanupRuns = 0;

function Bubble(props: { vm: { text: string } }) {
  // onSettled is the 2.0 component lifecycle primitive (replaces onMount +
  // onCleanup): setup after first settle, returned cleanup on owner disposal.
  onSettled(() => {
    setupRuns += 1;
    return () => {
      cleanupRuns += 1;
    };
  });
  return <p part="bubble">{props.vm.text}</p>;
}

class ChxHost extends HTMLElement {
  private dispose: (() => void) | undefined;
  connectedCallback(): void {
    const root = this.attachShadow({ mode: 'open' });
    // render returns the owner's disposer; keep it for disconnectedCallback.
    this.dispose = render(() => <Bubble vm={{ text: 'hello' }} />, root);
  }
  disconnectedCallback(): void {
    this.dispose?.();
    this.dispose = undefined;
  }
}
customElements.define('chx-host', ChxHost);

const settle = () => new Promise((r) => setTimeout(r, 0));

export async function run(): Promise<void> {
  const app = document.getElementById('app');
  const host = document.createElement('chx-host');
  app?.appendChild(host);
  await settle();

  const sr = host.shadowRoot;
  const bubble = sr?.querySelector('p[part="bubble"]');
  record({
    id: 'mount/renders-into-shadow-root',
    ok: !!bubble && bubble.textContent === 'hello',
    threw: false,
    note: `shadow html: ${sr?.innerHTML ?? '<none>'}`,
  });
  record({
    id: 'mount/setup-ran-once',
    ok: setupRuns === 1,
    threw: false,
    note: `setupRuns=${setupRuns}`,
  });

  host.remove();
  await settle();

  record({
    id: 'mount/dispose-runs-cleanup-once',
    ok: cleanupRuns === 1,
    threw: false,
    note: `cleanupRuns=${cleanupRuns}`,
  });

  markDone();
}
