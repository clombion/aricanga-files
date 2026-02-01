/**
 * chat-header.js - Header with presence status
 *
 * Displays the chat header with:
 * - Back button
 * - Contact avatar (clickable to open profile settings)
 * - Contact title
 * - Presence status (online/offline/typing/last seen)
 * - Disappearing message timer indicator
 */

import { getChat, t } from '../../services/conversation-context.js';
import { renderAvatar } from '../../utils/avatar.js';
import { escapeHtml } from '../../utils/text.js';

// Timer icon for disappearing messages
const TIMER_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
  <circle cx="12" cy="12" r="10"/>
  <polyline points="12 6 12 12 16 14"/>
</svg>`;

/**
 * ChatHeader - Chat thread header web component
 *
 * @element chat-header
 * @attr {string} title - Contact name to display
 * @attr {string} chat-id - Chat ID for config lookup (disappearing timer)
 * @fires {CustomEvent} back-clicked - When user clicks back button
 * @fires {CustomEvent} profile-clicked - When user clicks avatar/title to open profile settings
 */
export class ChatHeader extends HTMLElement {
  static get observedAttributes() {
    return ['title', 'chat-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._presence = null;
  }

  connectedCallback() {
    this.render();
    this.wireEvents();
  }

  attributeChangedCallback() {
    this.render();
    this.wireEvents();
  }

  get title() {
    return this.getAttribute('title') || '';
  }

  set title(value) {
    this.setAttribute('title', value);
  }

  get chatId() {
    return this.getAttribute('chat-id');
  }

  set chatId(value) {
    this.setAttribute('chat-id', value);
  }

  /**
   * Set presence status
   * @param {'online' | 'offline' | string | null} status - 'lastseen:TIME' format for last seen
   */
  setPresence(status) {
    // Ignore 'typing' - typing indicator at bottom is handled separately
    if (status === 'typing') return;

    this._presence = status;
    const subtitle = this.shadowRoot.querySelector('.presence');
    if (!subtitle) return;

    // Reset classes
    subtitle.classList.remove('online');

    if (!status) {
      subtitle.textContent = '';
      subtitle.hidden = true;
    } else if (status === 'online') {
      subtitle.textContent = 'online';
      subtitle.hidden = false;
      subtitle.classList.add('online');
    } else if (status === 'offline') {
      subtitle.textContent = 'offline';
      subtitle.hidden = false;
    } else if (status.startsWith('lastseen:')) {
      subtitle.textContent = `last seen ${status.slice(9)}`;
      subtitle.hidden = false;
    }
  }

  wireEvents() {
    this.shadowRoot
      .querySelector('.back-button')
      ?.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('back-clicked', { bubbles: true }));
      });

    this.shadowRoot
      .querySelector('.profile-button')
      ?.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('profile-clicked', { bubbles: true }),
        );
      });
  }

  render() {
    const chatConfig = getChat(this.chatId);
    const disappearingDuration = chatConfig?.disappearingDuration;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          flex-shrink: 0;
        }

        .header {
          display: flex;
          align-items: center;
          padding: var(--ink-space-sm, 8px) var(--ink-space-md, 15px);
          background: var(--ink-color-header, #3a3a3c);
        }

        .back-button {
          background: none;
          border: none;
          color: var(--ink-color-accent, #0a84ff);
          font-size: 1.5em;
          cursor: pointer;
          padding: 5px 10px 5px 0;
          font-family: inherit;
        }

        @media (hover: hover) {
          .back-button:hover {
            opacity: 0.8;
          }
        }
        .back-button:active {
          opacity: 0.8;
        }

        .profile-button {
          display: flex;
          align-items: center;
          gap: 10px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px 4px 4px;
          border-radius: 8px;
          flex: 1;
          min-width: 0;
          text-align: left;
        }

        .profile-button:focus {
          outline: none;
        }

        .profile-button:focus-visible {
          outline: 2px solid var(--ink-color-accent, #0a84ff);
          outline-offset: 2px;
        }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85em;
          font-weight: 300;
          flex-shrink: 0;
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

        .header-content {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .title {
          font-weight: 600;
          color: var(--ink-color-text, #f2f2f7);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        .header-subtitle {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .presence {
          font-size: var(--ink-font-size-tiny, 0.7em);
          color: var(--ink-color-text-secondary, #ababab);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .presence.online::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ink-color-success, #34c759);
        }

        .presence[hidden] {
          display: none;
        }

        .disappearing-timer {
          font-size: var(--ink-font-size-tiny, 0.7em);
          color: var(--ink-color-text-secondary, #ababab);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .disappearing-timer svg {
          opacity: 0.8;
        }
      </style>

      <header class="header">
        <button class="back-button" aria-label="${t('ui.a11y.back_to_chat_list')}">‹</button>
        <button class="profile-button" aria-label="${t('a11y.open_contact_settings')}">
          ${chatConfig ? renderAvatar(chatConfig) : ''}
          <div class="header-content">
            <span class="title">${escapeHtml(this.title)}</span>
            <div class="header-subtitle">
              <span class="presence" hidden></span>
              ${disappearingDuration ? `<span class="disappearing-timer">${TIMER_ICON} ${disappearingDuration}</span>` : ''}
            </div>
          </div>
        </button>
      </header>
    `;

    // Restore presence if set
    if (this._presence) {
      this.setPresence(this._presence);
    }
  }
}

customElements.define('chat-header', ChatHeader);
