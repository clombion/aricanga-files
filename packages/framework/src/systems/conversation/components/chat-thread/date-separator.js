/**
 * date-separator.js - Date dividers for chat threads
 *
 * Displays date labels (Today, Yesterday, Jan 8) between message groups.
 * Pure display component with no events.
 */

import { getLocale, t } from '../../services/conversation-context.js';
import { escapeHtml } from '../../utils/text.js';

/**
 * DateSeparator - Date divider web component
 *
 * @element date-separator
 * @attr {string} label - The date label to display
 */
export class DateSeparator extends HTMLElement {
  static get observedAttributes() {
    return ['label'];
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

  get label() {
    return this.getAttribute('label') || '';
  }

  set label(value) {
    this.setAttribute('label', value);
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 12px 0;
          font-size: var(--ink-font-size-small, 0.85em);
        }

        .separator-label {
          padding: 4px 12px;
          background: var(--ink-color-surface, #2c2c2e);
          color: #a1a1aa; /* Lighter than --ink-color-text-muted for WCAG AA contrast */
          border-radius: 10px;
        }
      </style>

      <div role="presentation">
        <span class="separator-label">${escapeHtml(this.label)}</span>
      </div>
    `;
  }
}

customElements.define('date-separator', DateSeparator);

/**
 * Get display label for a date
 * @param {string} dateStr - Date string (ISO format, or relative like "-1")
 * @returns {string | null} - "Today", "Yesterday", or "Jan 8" format
 */
export function getDateLabel(dateStr) {
  if (!dateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let targetDate;

  // Handle relative dates like "-1" for yesterday, "-30" for 30 days ago
  if (dateStr.startsWith('-')) {
    const daysAgo = parseInt(dateStr, 10);
    targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysAgo);
  } else {
    // Parse ISO date string
    targetDate = new Date(dateStr);
  }
  targetDate.setHours(0, 0, 0, 0);

  if (targetDate.getTime() === today.getTime()) {
    return t('dates.today');
  }
  if (targetDate.getTime() === yesterday.getTime()) {
    return t('dates.yesterday');
  }

  // Format as "Jan 8" or "Jul 30" using current locale
  return targetDate.toLocaleDateString(getLocale(), {
    month: 'short',
    day: 'numeric',
  });
}
