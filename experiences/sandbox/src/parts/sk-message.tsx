// The sandbox's mount: a custom element that renders one Solid root, the message part behind its
// error boundary, into its shadow root on connect and disposes the root on disconnect (ADR-0008).
// The element holds the view-model it was handed; the part reads it and holds nothing.

import type { Accessor, Setter } from 'solid-js';
import { Errored, createSignal } from 'solid-js';
import { Message } from '#parts/message';
import type { MessageVm } from '#parts/message';
import { css } from '#src/sheet';
import { render } from '@solidjs/web';

/** The tag the message element registers under. */
const TAG = 'sk-message';

/** The view-model an element shows before it is handed one. */
const EMPTY: MessageVm = { text: '' };

/** The part's rules, adopted by every element's shadow root. */
const SHEET: CSSStyleSheet = css`
  :host {
    display: block;
    font-family: var(--font-body);
    font-size: var(--text-body);
    line-height: var(--leading-body);
  }

  .bubble {
    background-color: var(--surface-bubble);
    border-radius: var(--radius-bubble);
    margin: 0;
    padding-block: var(--space-bubble-block);
    padding-inline: var(--space-bubble-inline);
  }
`;

class SkMessage extends HTMLElement {
  private readonly read: Accessor<MessageVm>;

  private readonly write: Setter<MessageVm>;

  private dispose: (() => void) | undefined = undefined;

  public constructor() {
    super();
    const [read, write] = createSignal<MessageVm>(EMPTY);
    this.read = read;
    this.write = write;
  }

  /**
   * Hand the element the view-model its part shows; the part shows it at the next flush.
   * @param {MessageVm} next The view-model.
   */
  public show(next: MessageVm): void {
    this.write(() => next);
  }

  /** Render the part into the shadow root, attached on the first connect and kept after. */
  public connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [SHEET];
    this.dispose = render(
      () => (
        <Errored fallback="">
          <Message vm={this.read()} />
        </Errored>
      ),
      root,
    );
  }

  /** Dispose the root: its nodes leave the shadow root, and a later connect renders afresh. */
  public disconnectedCallback(): void {
    this.dispose?.();
    this.dispose = undefined;
  }
}

/** Register the element under its tag, once: a second call leaves the registration alone. */
function defineSkMessage(): void {
  if (customElements.get(TAG) === undefined) {
    customElements.define(TAG, SkMessage);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sk-message': SkMessage;
  }
}

export { SkMessage, defineSkMessage };
