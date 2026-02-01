/**
 * conversation-banner.js - Chat start banner with avatar and title
 *
 * Displays at the top of a chat thread showing:
 * - Contact avatar (image or letter)
 * - Contact name
 * - Optional description
 * - Optional system message
 */

import { getChat, getChatType } from '../../services/conversation-context.js';
import { renderAvatar } from '../../utils/avatar.js';
import { escapeHtml } from '../../utils/text.js';

/**
 * ConversationBanner - Chat start banner web component
 *
 * @element conversation-banner
 * @attr {string} chat-id - The chat ID for config lookup
 */
export class ConversationBanner extends HTMLElement {
  static get observedAttributes() {
    return ['chat-id'];
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

  get chatId() {
    return this.getAttribute('chat-id');
  }

  set chatId(value) {
    this.setAttribute('chat-id', value);
  }

  /**
   * Get system message for this chat based on chat type
   * @returns {{ text: string, type: string, id: string } | null}
   */
  getSystemMessage() {
    const chatConfig = getChat(this.chatId);
    if (!chatConfig) return null;

    const typeConfig = getChatType(chatConfig.chatType);
    if (!typeConfig) return null;

    // Per-chat override or type default
    let text = chatConfig.systemMessage || typeConfig.systemMessage;
    if (!text) return null;

    // Replace template variables
    text = text.replace('{duration}', chatConfig.disappearingDuration || '');
    text = text.replace('{name}', chatConfig.title || '');

    return { text, type: 'system', id: 'system-intro' };
  }

  render() {
    const config = getChat(this.chatId);
    if (!config) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const systemMsg = this.getSystemMessage();
    const systemMessageHtml = systemMsg
      ? `<div class="message system" data-type="system"><span class="text">${escapeHtml(systemMsg.text)}</span></div>`
      : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .conversation-start {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px 30px;
          text-align: center;
        }

        .banner-avatar {
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

        .banner-avatar.avatar-image {
          background: var(--ink-color-surface);
          overflow: hidden;
        }

        .banner-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }

        .banner-title {
          font-size: 1.2em;
          font-weight: 600;
          color: var(--ink-color-text, #e8e8ed);
          margin-bottom: 8px;
          max-width: 280px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .banner-description {
          font-size: 0.85em;
          color: var(--ink-color-text-secondary, #a1a1aa);
          max-width: 280px;
          line-height: 1.5;
          padding: 12px 16px;
          background: var(--ink-color-surface, #1e1e24);
          border-radius: 12px;
        }

        .message.system {
          background: none;
          color: var(--ink-color-text-secondary, #a1a1aa);
          font-style: italic;
          font-size: var(--ink-font-size-small, 0.85em);
          text-align: center;
          max-width: 90%;
          padding: 10px 15px;
          margin: 0 auto;
        }
      </style>

      <div class="conversation-start">
        ${renderAvatar(config, { cssClass: 'banner-avatar' })}
        <div class="banner-title">${escapeHtml(config.title)}</div>
        ${config.description ? `<div class="banner-description">${escapeHtml(config.description)}</div>` : ''}
      </div>
      ${systemMessageHtml}
    `;
  }
}

customElements.define('conversation-banner', ConversationBanner);
