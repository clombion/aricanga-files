import { css, type CSSResult, html, LitElement, type PropertyDeclarations, type TemplateResult } from 'lit';

// Baseline Lit Web Component for the Phase 0 skeleton (replaced by a Solid part in #24).
// No decorators — uses static `properties` so it compiles cleanly under strict
// TypeScript with `useDefineForClassFields`, and proves the Lit + Shadow DOM
// toolchain end to end.
export class SkMessage extends LitElement {
  static override properties: PropertyDeclarations = { text: { type: String } };

  static override styles: CSSResult = css`
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

  declare text: string;

  constructor() {
    super();
    this.text = '';
  }

  override render(): TemplateResult {
    return html`<p part="bubble">${this.text}</p>`;
  }
}

customElements.define('sk-message', SkMessage);

declare global {
  interface HTMLElementTagNameMap {
    'sk-message': SkMessage;
  }
}
