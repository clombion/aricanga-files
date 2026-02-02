/**
 * conversation-settings.js - Per-conversation settings page
 *
 * Displays when user taps the avatar/title in the chat header:
 * - Large contact avatar
 * - Contact name
 * - Search button (placeholder)
 * - Disappearing messages status
 * - Chat color & wallpaper (placeholder)
 */

import { getChat, t } from '../services/conversation-context.js';
import { renderAvatar } from '../utils/avatar.js';
import { backIcon, timerIcon } from '../utils/icons.js';
import {
  escapeHtml,
  LEARNING_HIGHLIGHT_CSS,
  processText,
  wireGlossaryClicks,
} from '../utils/text.js';

const BACK_ICON = backIcon();

const SEARCH_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
  <circle cx="11" cy="11" r="8"/>
  <path d="M21 21l-4.35-4.35"/>
</svg>`;

const TIMER_ICON = timerIcon(24, { withAlarm: true });

const PALETTE_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
  <circle cx="13.5" cy="6.5" r="2"/>
  <circle cx="17.5" cy="10.5" r="2"/>
  <circle cx="8.5" cy="7.5" r="2"/>
  <circle cx="6.5" cy="12.5" r="2"/>
  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z"/>
</svg>`;

/**
 * ConversationSettings - Per-conversation settings page
 *
 * @element conversation-settings
 * @attr {string} chat-id - The chat ID for config lookup
 * @fires {CustomEvent} settings-closed - When user clicks back button
 */
export class ConversationSettings extends HTMLElement {
  static get observedAttributes() {
    return ['chat-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.wireEvents();
  }

  attributeChangedCallback() {
    this.render();
    this.wireEvents();
  }

  get chatId() {
    return this.getAttribute('chat-id');
  }

  set chatId(value) {
    this.setAttribute('chat-id', value);
  }

  wireEvents() {
    this.shadowRoot
      .querySelector('.back-button')
      ?.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('settings-closed', { bubbles: true }),
        );
      });

    wireGlossaryClicks(this.shadowRoot, this);
  }

  render() {
    const config = getChat(this.chatId);
    if (!config) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const disappearingDuration =
      config.disappearingDuration || t('conversation_settings.off');

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

        /* Header with back button */
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

        .back-button:hover {
          background: var(--ink-color-surface, #1e1e24);
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

        /* Content area */
        .content {
          flex: 1;
          overflow-y: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .content::-webkit-scrollbar {
          display: none;
        }

        /* Profile section */
        .profile-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 30px 20px;
          text-align: center;
        }

        .avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.8em;
          font-weight: 300;
          margin-bottom: 12px;
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

        .contact-name {
          font-size: 1.2em;
          font-weight: 600;
          color: var(--ink-color-text, #e8e8ed);
          margin-bottom: 4px;
        }

        .contact-status {
          color: var(--ink-color-text-secondary, #a1a1aa);
          font-size: 0.85em;
          line-height: 1.4;
          margin-bottom: 20px;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        .no-status {
          margin-bottom: 20px;
        }

        ${LEARNING_HIGHLIGHT_CSS}

        /* Action buttons row */
        .actions {
          display: flex;
          justify-content: center;
          gap: 16px;
        }

        .action-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          color: var(--ink-color-text-muted, #71717a);
          cursor: not-allowed;
          padding: 12px 16px;
          border-radius: 12px;
          opacity: 0.5;
        }

        .action-button .icon {
          width: 48px;
          height: 48px;
          background: var(--ink-color-surface, #1e1e24);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .action-button .label {
          font-size: 0.75em;
        }

        /* Settings rows */
        .settings-section {
          margin-top: 16px;
          border-top: 1px solid var(--ink-color-surface, #1e1e24);
          padding-top: 8px;
        }

        .setting-row {
          display: flex;
          align-items: center;
          padding: 14px 20px;
          gap: 16px;
          color: var(--ink-color-text, #e8e8ed);
        }

        .setting-row.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .setting-icon {
          width: 24px;
          height: 24px;
          color: var(--ink-color-text-muted, #71717a);
          flex-shrink: 0;
        }

        .setting-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .setting-label {
          font-size: 1em;
        }

        .setting-value {
          font-size: 0.85em;
          color: var(--ink-color-text-muted, #71717a);
        }
      </style>

      <header class="header">
        <button class="back-button" aria-label="${t('a11y.back')}">
          ${BACK_ICON}
        </button>
        <span class="header-title">${t('conversation_settings.contact')}</span>
      </header>

      <div class="content">
        <div class="profile-section">
          ${renderAvatar(config)}
          <div class="contact-name${config.status ? '' : ' no-status'}">${escapeHtml(config.title)}</div>
          ${config.status ? `<div class="contact-status">${processText(config.status)}</div>` : ''}

          <div class="actions">
            <button class="action-button" disabled aria-label="${t('conversation_settings.search')}">
              <span class="icon">${SEARCH_ICON}</span>
              <span class="label">${t('conversation_settings.search')}</span>
            </button>
          </div>
        </div>

        <div class="settings-section">
          <div class="setting-row">
            <span class="setting-icon">${TIMER_ICON}</span>
            <div class="setting-content">
              <span class="setting-label">${t('conversation_settings.disappearing_messages')}</span>
              <span class="setting-value">${escapeHtml(disappearingDuration)}</span>
            </div>
          </div>

          <div class="setting-row disabled">
            <span class="setting-icon">${PALETTE_ICON}</span>
            <div class="setting-content">
              <span class="setting-label">${t('conversation_settings.chat_color_wallpaper')}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('conversation-settings', ConversationSettings);
