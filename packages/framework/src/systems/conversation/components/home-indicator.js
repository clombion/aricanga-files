// Home Indicator - iOS-style bottom bar
// Visual anchor that completes the "phone" metaphor

export class HomeIndicator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: var(--ink-space-sm, 8px) 0;
          background: var(--ink-color-bg, #1c1c1e);
          flex-shrink: 0;
        }

        .bar {
          width: var(--ink-home-indicator-width, 134px);
          height: var(--ink-home-indicator-height, 5px);
          background: var(--ink-color-text-muted, #8e8e93);
          border-radius: 3px;
          opacity: 0.6;
        }
      </style>
      <div class="bar" aria-hidden="true"></div>
    `;
  }
}

customElements.define('home-indicator', HomeIndicator);
