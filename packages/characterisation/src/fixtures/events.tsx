/**
 * Events: a delegated handler inside a shadow root fires on a real user click; a synthetic
 * non-bubbling dispatch is recorded for whether it reaches the delegated handler.
 */

import { markDone, record } from '#src/harness';
import { createSignal } from 'solid-js';
import { render } from '@solidjs/web';

/** The count before any click. */
const NO_CLICKS = 0;

/** What one click adds. */
const ONE_CLICK = 1;

/** A custom element rendering one delegated-click button into its shadow root. */
class EventsHost extends HTMLElement {
  public readonly clicks: () => number;
  private readonly setClicks: (next: number) => void;
  private dispose: (() => void) | undefined = undefined;

  public constructor() {
    super();
    const [clicks, setClicks] = createSignal(NO_CLICKS);
    this.clicks = clicks;
    this.setClicks = (next: number): void => {
      setClicks(next);
    };
  }

  public connectedCallback(): void {
    const root = this.attachShadow({ mode: 'open' });
    this.dispose = render(
      () => (
        <button
          type="button"
          id="delegated"
          onClick={() => {
            this.setClicks(this.clicks() + ONE_CLICK);
          }}
        >
          clicked {this.clicks()}
        </button>
      ),
      root,
    );
  }

  public disconnectedCallback(): void {
    this.dispose?.();
  }
}

/** Mount the element, dispatch a non-bubbling synthetic click, and record what the button shows. */
function run(): void {
  customElements.define('chx-events-host', EventsHost);
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

export { run };
