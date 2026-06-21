import { css, html, LitElement } from 'lit';

// Baseline Lit Web Component for the Phase 0 skeleton (task-003).
// No decorators — uses static `properties` so it compiles cleanly under strict
// TypeScript with `useDefineForClassFields`, and proves the Lit + Shadow DOM
// toolchain end to end.
export class SkMessage extends LitElement {
  static override properties = { text: { type: String } };

  static override styles = css`
    :host {
      display: block;
      font: 14px/1.4 system-ui, sans-serif;
    }
    p {
      margin: 0;
      padding: 8px 12px;
      border-radius: 12px;
      background: #e9e9eb;
    }
  `;

  declare text: string;

  constructor() {
    super();
    this.text = '';
  }

  override render() {
    return html`<p part="bubble">${this.text}</p>`;
  }
}

customElements.define('sk-message', SkMessage);

declare global {
  interface HTMLElementTagNameMap {
    'sk-message': SkMessage;
  }
}
