/**
 * unread-separator.js - "New messages" divider for chat threads
 *
 * Displays a horizontal line with unread count below (Signal-style).
 * Pure display component - removed from DOM when new messages arrive.
 */

import { t } from '../../services/conversation-context.js';
import { escapeHtml } from '../../utils/text.js';

/**
 * UnreadSeparator - Unread divider web component
 *
 * @element unread-separator
 * @attr {string} count - Number of unread messages to display
 */
export class UnreadSeparator extends HTMLElement {
  static get observedAttributes() {
    return ['count'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  get count() {
    return parseInt(this.getAttribute('count'), 10) || 0;
  }

  set count(value) {
    this.setAttribute('count', String(value));
  }

  render() {
    const count = this.count;
    const label =
      count === 1
        ? t('messages.unread_singular') || '1 unread message'
        : (t('messages.unread_plural') || '{count} unread messages').replace(
            '{count}',
            String(count),
          );

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          margin: 16px 0;
        }
        :host([hidden]) {
          display: none;
        }
        .line {
          height: 1px;
          background: var(--ink-color-text-secondary, #8e8e93);
        }
        .label {
          text-align: center;
          padding-top: 8px;
          font-size: var(--ink-font-size-small, 0.85em);
          color: var(--ink-color-text-secondary, #8e8e93);
        }
      </style>
      <div class="line"></div>
      <div class="label">${escapeHtml(label)}</div>
    `;
  }
}

customElements.define('unread-separator', UnreadSeparator);
