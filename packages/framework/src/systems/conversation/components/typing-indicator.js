// Typing Indicator - Animated three-dot bubble
// Shows when another character is composing a message

import { t } from '../services/conversation-context.js';
import { escapeHtml } from '../utils/text.js';

export class TypingIndicator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._speaker = null;
  }

  connectedCallback() {
    this.render();
  }

  /**
   * Show typing indicator with optional speaker name
   * @param {string} [speaker]
   */
  show(speaker) {
    this._speaker = speaker;
    this.hidden = false;
    this.render();
  }

  hide() {
    this.hidden = true;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: flex-start;
          padding: 0 var(--ink-space-md, 15px) var(--ink-space-sm, 8px);
        }

        :host([hidden]) {
          display: none;
        }

        .container {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--ink-space-xs, 4px);
        }

        .speaker {
          font-size: var(--ink-font-size-tiny, 0.7em);
          color: var(--ink-color-text-muted, #8e8e93);
          padding-left: var(--ink-space-xs, 4px);
        }

        .bubble {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 12px 16px;
          background: var(--ink-bubble-received-bg, #3a3a3c);
          border-radius: var(--ink-radius-bubble, 18px);
          border-bottom-left-radius: 4px;
        }

        .dot {
          width: 8px;
          height: 8px;
          background: var(--ink-color-text-muted, #8e8e93);
          border-radius: 50%;
          animation: bounce 1.0s ease-in-out infinite;
        }

        .dot:nth-child(1) {
          animation-delay: 0s;
        }

        .dot:nth-child(2) {
          animation-delay: 0.15s;
        }

        .dot:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes bounce {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dot {
            animation: none;
          }
          /* Show static dots with varying opacity instead */
          .dot:nth-child(1) { opacity: 0.4; }
          .dot:nth-child(2) { opacity: 0.7; }
          .dot:nth-child(3) { opacity: 1; }
        }
      </style>

      <div class="container">
        ${this._speaker ? `<span class="speaker">${escapeHtml(this._speaker)}</span>` : ''}
        <div class="bubble" aria-label="${this._speaker ? t('ui.status.typing', { name: this._speaker }) : t('ui.status.someone_typing')}">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
    `;
  }
}

customElements.define('typing-indicator', TypingIndicator);
