/**
 * Events: a delegated handler inside a shadow root fires on a real user click; a synthetic
 * non-bubbling dispatch is recorded for whether it reaches the delegated handler.
 */

import { render } from '@solidjs/web';
import { createSignal } from 'solid-js';

import { markDone, record } from '../harness';

class EventsHost extends HTMLElement {
  readonly clicks: () => number;
  private readonly setClicks: (next: number) => void;
  private dispose: (() => void) | undefined;

  constructor() {
    super();
    const [clicks, setClicks] = createSignal(0);
    this.clicks = clicks;
    this.setClicks = setClicks;
  }

  connectedCallback(): void {
    const root = this.attachShadow({ mode: 'open' });
    this.dispose = render(
      () => (
        <button type="button" id="delegated" onClick={() =>{  this.setClicks(this.clicks() + 1); }}>
          clicked {this.clicks()}
        </button>
      ),
      root,
    );
  }

  disconnectedCallback(): void {
    this.dispose?.();
  }
}
customElements.define('chx-events-host', EventsHost);

export function run(): void {
  const host = new EventsHost();
  host.id = 'events-host';
  document.body.append(host);
  const button = host.shadowRoot?.querySelector('button');
  button?.dispatchEvent(new MouseEvent('click', { bubbles: false, composed: false }));
  queueMicrotask(() => {
    record({
      id: 'events/non-bubbling-dispatch',
      note: `delegated handler after a non-bubbling synthetic click: ${button?.textContent ?? '<none>'}`,
      ok: true,
      threw: false,
    });
    markDone();
  });
}
