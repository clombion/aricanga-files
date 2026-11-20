// Baseline Lit Web Component for the Phase 0 skeleton (replaced by a Solid part in #24).
// No decorators: it uses static `properties` so it compiles cleanly under strict
// TypeScript with `useDefineForClassFields`, and proves the Lit + Shadow DOM
// toolchain end to end.

import type { CSSResult, PropertyDeclarations, TemplateResult } from 'lit';
import { LitElement, css, html } from 'lit';

/** The tag the message element registers under. */
const TAG = 'sk-message';

class SkMessage extends LitElement {
  public static override properties: PropertyDeclarations = { text: { type: String } };

  public static override styles: CSSResult = css`
    :host {
      display: block;
      font-family: var(--font-body);
      font-size: var(--text-body);
      line-height: var(--leading-body);
    }

    p {
      margin: 0;
      padding-block: var(--space-bubble-block);
      padding-inline: var(--space-bubble-inline);
      border-radius: var(--radius-bubble);
      background-color: var(--surface-bubble);
    }
  `;

  declare public text: string;

  public constructor() {
    super();
    this.text = '';
  }

  public override render(): TemplateResult {
    return html`<p part="bubble">${this.text}</p>`;
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
