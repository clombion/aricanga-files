/**
 * player-profile.js - WhatsApp-style player profile page
 *
 * Displays when user taps their avatar in the hub header:
 * - Header with back arrow + "Profile" title
 * - Large avatar (profile image or letter fallback)
 * - Info rows: Name, About, Contact (icon + label + value)
 */

import { getApp, t } from '../services/conversation-context.js';
import { getProfileImage } from '../services/profile-image.js';
import { renderAvatar } from '../utils/avatar.js';
import {
  escapeHtml,
  LEARNING_HIGHLIGHT_CSS,
  processText,
  wireGlossaryClicks,
} from '../utils/text.js';

const BACK_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
  <polyline points="15 18 9 12 15 6"/>
</svg>`;

const PERSON_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
  <circle cx="12" cy="7" r="4"/>
</svg>`;

const INFO_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="10"/>
  <path d="M12 16v-4"/>
  <path d="M12 8h.01"/>
</svg>`;

const CONTACT_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <path d="M22 7l-10 7L2 7"/>
</svg>`;

/**
 * PlayerProfile - WhatsApp-style player profile page
 *
 * @element player-profile
 * @fires {CustomEvent} navigate-back - When user clicks back button
 */
export class PlayerProfile extends HTMLElement {
  static get observedAttributes() {
    return ['hidden'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Defer render to when the component is actually shown,
    // since config/i18n may not be ready at connect time (BUG-002)
    if (!this.hidden) {
      this.render();
      this.wireEvents();
    }
  }

  attributeChangedCallback(name) {
    if (name === 'hidden' && !this.hidden) {
      this.render();
      this.wireEvents();
    }
  }

  wireEvents() {
    this.shadowRoot
      .querySelector('.back-button')
      ?.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('navigate-back', { bubbles: true, composed: true }),
        );
      });

    wireGlossaryClicks(this.shadowRoot, this);
  }

  renderPlayerAvatar() {
    const app = getApp();
    const profileImage = getProfileImage(app.profileImages || []);
    if (profileImage) {
      return `<div class="avatar avatar-image">
        <img src="assets/${profileImage}" alt="" />
      </div>`;
    }
    return renderAvatar({ title: t('hub.you') });
  }

  render() {
    const app = getApp();
    const playerName = t('hub.you');
    const playerStatus = app.playerStatus || '';
    const playerEmail = app.playerEmail || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--ink-color-bg, #1c1c1e);
          overflow: hidden;
        }
        :host([hidden]) {
          display: none;
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: var(--ink-space-md, 15px);
          background: var(--ink-color-header, #1a1a20);
          flex-shrink: 0;
        }

        .back-button {
          background: none;
          border: none;
          color: var(--ink-color-accent, #0a84ff);
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .back-button:focus {
          outline: none;
        }

        .back-button:focus-visible {
          outline: 2px solid var(--ink-color-accent, #0a84ff);
          outline-offset: 2px;
        }

        .header-title {
          font-size: 1.15em;
          font-weight: 500;
          color: var(--ink-color-text, #e8e8ed);
        }

        /* Scrollable content */
        .content {
          flex: 1;
          overflow-y: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .content::-webkit-scrollbar {
          display: none;
        }

        /* Avatar section */
        .avatar-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 20px 24px;
        }

        .avatar {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3.2em;
          font-weight: 300;
        }

        .avatar-image {
          background: var(--ink-color-surface);
          overflow: hidden;
        }

        .avatar-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }

        /* Info rows */
        .info-section {
          padding: 0 20px;
        }

        .info-row {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          padding: 18px 0;
          border-bottom: 1px solid var(--ink-border-subtle, rgba(255, 255, 255, 0.08));
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-icon {
          width: 24px;
          height: 24px;
          color: var(--ink-color-text-muted, #71717a);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .info-content {
          flex: 1;
          min-width: 0;
        }

        .info-label {
          font-size: 0.95em;
          font-weight: 500;
          color: var(--ink-color-text, #e8e8ed);
          margin-bottom: 2px;
        }

        .info-value {
          font-size: 0.85em;
          color: var(--ink-color-text-secondary, #a1a1aa);
          line-height: 1.4;
          word-break: break-word;
        }

        ${LEARNING_HIGHLIGHT_CSS}
      </style>

      <header class="header">
        <button class="back-button" aria-label="${t('a11y.back')}">
          ${BACK_ICON}
        </button>
        <span class="header-title">${escapeHtml(t('profile.title'))}</span>
      </header>

      <div class="content">
        <div class="avatar-section">
          ${this.renderPlayerAvatar()}
        </div>

        <div class="info-section">
          <div class="info-row">
            <span class="info-icon">${PERSON_ICON}</span>
            <div class="info-content">
              <div class="info-label">${escapeHtml(t('profile.name'))}</div>
              <div class="info-value">${escapeHtml(playerName)}</div>
            </div>
          </div>

          ${
            playerStatus
              ? `
          <div class="info-row">
            <span class="info-icon">${INFO_ICON}</span>
            <div class="info-content">
              <div class="info-label">${escapeHtml(t('profile.about'))}</div>
              <div class="info-value">${processText(playerStatus)}</div>
            </div>
          </div>
          `
              : ''
          }

          ${
            playerEmail
              ? `
          <div class="info-row">
            <span class="info-icon">${CONTACT_ICON}</span>
            <div class="info-content">
              <div class="info-label">${escapeHtml(t('profile.contact'))}</div>
              <div class="info-value">${escapeHtml(playerEmail)}</div>
            </div>
          </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  }
}

customElements.define('player-profile', PlayerProfile);
