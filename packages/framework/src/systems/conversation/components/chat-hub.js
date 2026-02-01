/**
 * chat-hub.js - Signal-style conversation list with sections and letter avatars
 *
 * Main navigation component showing all available chats grouped by pinned/recent.
 * Displays unread badges, message previews, and handles chat selection.
 */

// Foundation services
import { eventBus } from '../../../foundation/services/event-bus.js';
// Conversation system events
import { EVENTS } from '../events/events.js';
import {
  getApp,
  getChat,
  getChatIds,
  I18N_EVENTS,
  t,
} from '../services/conversation-context.js';
import { getProfileImage } from '../services/profile-image.js';
import { renderAvatar } from '../utils/avatar.js';
import { stripGlossaryMarkup } from '../utils/text.js';
import { RECEIPT_ICONS } from './chat-thread/message-bubble.js';

/**
 * ChatHub - Conversation list web component
 *
 * @element chat-hub
 * @fires {CustomEvent} chat-selected - When user selects a conversation
 */
export class ChatHub extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.unreadState = {};
    this.previews = {}; // { chatId: { text, time, type } }
    this._unsubscribers = [];
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.subscribeToEvents();
  }

  disconnectedCallback() {
    // Clean up EventBus subscriptions
    for (const unsub of this._unsubscribers) {
      unsub();
    }
    this._unsubscribers = [];
    // Clean up document listener
    if (this._boundClearFresh) {
      document.removeEventListener(
        'drawer-open-requested',
        this._boundClearFresh,
      );
      this._boundClearFresh = null;
    }
  }

  subscribeToEvents() {
    // Subscribe to notification events for unread badges
    this._unsubscribers.push(
      eventBus.on(EVENTS.NOTIFICATION_SHOW, (e) => {
        this.setUnread(e.detail.chatId, true);
      }),
    );

    // Clear badge when chat is opened
    this._unsubscribers.push(
      eventBus.on(EVENTS.CHAT_OPENED, (e) => {
        this.setUnread(e.detail.chatId, false);
      }),
    );

    // Subscribe to messages for preview updates
    this._unsubscribers.push(
      eventBus.on(EVENTS.MESSAGE_RECEIVED, (e) => {
        const { chatId, message, isCurrentChat } = e.detail;
        if (message.text) {
          const displayTime = isCurrentChat
            ? message.time || ''
            : t('time.now');
          this.setPreview(
            chatId,
            message.text,
            displayTime,
            message.type || 'received',
          );
          // Store canonical time so we can revert "Now" later
          if (!isCurrentChat) {
            this.previews[chatId].canonicalTime = message.time || '';
          }
        }
      }),
    );

    // Dismiss "Now" overrides on user interaction
    const clearFresh = () => this._clearAllFreshPreviews();
    this._unsubscribers.push(eventBus.on(EVENTS.CHAT_OPENED, clearFresh));
    this._unsubscribers.push(eventBus.on(EVENTS.CHAT_CLOSED, clearFresh));
    this._unsubscribers.push(eventBus.on(EVENTS.CHOICES_AVAILABLE, clearFresh));
    this._boundClearFresh = clearFresh;
    document.addEventListener('drawer-open-requested', this._boundClearFresh);

    // Re-render on runtime locale switch (initial render is safe via deferred registration)
    this._unsubscribers.push(
      eventBus.on(I18N_EVENTS.LOCALE_CHANGED, () => this.render()),
    );
  }

  setupEventListeners() {
    // Native button handles Enter/Space automatically
    this.shadowRoot.addEventListener('click', (e) => {
      // Player avatar → profile page
      if (e.target.closest('.player-avatar')) {
        this.dispatchEvent(
          new CustomEvent('player-profile-requested', { bubbles: true }),
        );
        return;
      }

      const btn = e.target.closest('.chat-item-btn');
      if (btn) {
        const item = btn.closest('.chat-item');
        this.dispatchEvent(
          new CustomEvent('chat-selected', {
            detail: { chatId: item.dataset.chat },
            bubbles: true,
          }),
        );
      }
    });
  }

  setUnread(chatId, unread) {
    if (unread) {
      this.unreadState[chatId] = (this.unreadState[chatId] || 0) + 1;
    } else {
      this.unreadState[chatId] = 0;
    }
    const count = this.unreadState[chatId];
    const badge = this.shadowRoot.querySelector(
      `[data-chat="${chatId}"] .unread-badge`,
    );
    if (badge) {
      badge.hidden = !count;
      badge.textContent = count > 0 ? String(count) : '';
    }
    const item = this.shadowRoot.querySelector(`[data-chat="${chatId}"]`);
    if (item) {
      item.classList.toggle('unread', count > 0);
    }
    // Toggle status-indicator visibility
    const status = this.shadowRoot.querySelector(
      `[data-chat="${chatId}"] .status-indicator`,
    );
    if (status) {
      const receipt = status.querySelector('.preview-receipt');
      const hasVisible = count > 0 || (receipt && !receipt.hidden);
      status.classList.toggle('visible', hasVisible);
    }
  }

  /**
   * Set preview text, timestamp, and type for a chat
   * @param {string} chatId
   * @param {string} text - Preview text
   * @param {string} time - Timestamp string
   * @param {string} type - Message type: 'sent', 'received', or 'system'
   */
  setPreview(chatId, text, time, type = 'received') {
    this.previews[chatId] = { text, time, type };
    const previewEl = this.shadowRoot.querySelector(
      `[data-chat="${chatId}"] .preview`,
    );
    const timeEl = this.shadowRoot.querySelector(
      `[data-chat="${chatId}"] .time`,
    );
    const receiptEl = this.shadowRoot.querySelector(
      `[data-chat="${chatId}"] .preview-receipt`,
    );

    if (previewEl) {
      const isSent = type === 'sent';
      const prefix = isSent ? `${t('hub.you')}: ` : '';
      const clean = stripGlossaryMarkup(text || t('hub.tap_to_open'));
      previewEl.textContent = prefix + clean;
    }
    if (timeEl) {
      timeEl.textContent = time || '';
    }
    if (receiptEl) {
      const isSent = type === 'sent';
      const isMyNotes = chatId === 'notes';
      const hasUnread = (this.unreadState[chatId] || 0) > 0;
      receiptEl.hidden = !(isSent && !isMyNotes && !hasUnread);
    }
    // Toggle status-indicator visibility
    const status = this.shadowRoot.querySelector(
      `[data-chat="${chatId}"] .status-indicator`,
    );
    if (status) {
      const badge = status.querySelector('.unread-badge');
      const receipt = status.querySelector('.preview-receipt');
      const hasVisible =
        (badge && !badge.hidden) || (receipt && !receipt.hidden);
      status.classList.toggle('visible', hasVisible);
    }
  }

  /**
   * Revert all "Now" preview timestamps to their canonical times
   */
  _clearAllFreshPreviews() {
    for (const [chatId, preview] of Object.entries(this.previews)) {
      if (preview.canonicalTime != null) {
        const timeEl = this.shadowRoot.querySelector(
          `[data-chat="${chatId}"] .time`,
        );
        if (timeEl) timeEl.textContent = preview.canonicalTime;
        preview.canonicalTime = undefined;
      }
    }
  }

  /**
   * Get chats split by pinned status
   */
  getChatsBySection() {
    const pinned = [];
    const regular = [];
    for (const id of getChatIds()) {
      const config = getChat(id);
      if (config?.pinned) {
        pinned.push({ id, ...config });
      } else if (config) {
        regular.push({ id, ...config });
      }
    }
    return { pinned, regular };
  }

  /**
   * Render player profile avatar in header-right
   */
  renderPlayerAvatar() {
    const app = getApp();
    const profileImage = getProfileImage(app.profileImages || []);
    if (!profileImage) return '';
    return `<button class="player-avatar" aria-label="${t('hub.profile')}" type="button">
      <img src="assets/${profileImage}" alt="" />
    </button>`;
  }

  /**
   * Render a single chat item
   */
  renderChatItem(chat) {
    const preview = this.previews[chat.id];
    const isMyNotes = chat.id === 'notes';
    const isSent = preview?.type === 'sent';

    // Build preview text with "You:" prefix for sent messages
    let previewText = stripGlossaryMarkup(
      preview?.text || t('hub.tap_to_open'),
    );
    if (isSent) {
      previewText = `${t('hub.you')}: ${previewText}`;
    }

    // Show read icon for sent messages (except My Notes)
    const showReceipt = isSent && !isMyNotes;

    const unreadCount = this.unreadState[chat.id] || 0;
    const hasUnread = unreadCount > 0;
    return `
      <li class="chat-item${hasUnread ? ' unread' : ''}" data-chat="${chat.id}">
        <button class="chat-item-btn" aria-label="${chat.title}${hasUnread ? `, ${t('messages.unread')}` : ''}">
          ${renderAvatar(chat)}
          <div class="details">
            <div class="title-row">
              <span class="title">${chat.title}</span>
              <span class="time">${preview?.time || ''}</span>
            </div>
            <div class="preview-row">
              <div class="preview">${previewText}</div>
              <span class="status-indicator${hasUnread || showReceipt ? ' visible' : ''}">
                <span class="unread-badge" role="status" ${hasUnread ? '' : 'hidden'} aria-label="${t('messages.unread')}">${hasUnread ? unreadCount : ''}</span>
                <span class="preview-receipt" ${showReceipt && !hasUnread ? '' : 'hidden'}>${RECEIPT_ICONS.read}</span>
              </span>
            </div>
          </div>
        </button>
      </li>
    `;
  }

  render() {
    const { pinned, regular } = this.getChatsBySection();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--ink-color-bg, #1c1c1e);
        }
        :host([hidden]) {
          display: none;
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: var(--ink-color-header, #1a1a20);
          flex-shrink: 0;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .app-title {
          font-size: 1.25em;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: var(--ink-color-text, #e8e8ed);
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .player-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
        }
        .player-avatar:focus {
          outline: none;
        }
        .player-avatar:focus-visible {
          outline: 2px solid var(--ink-color-accent, #5b7cfa);
          outline-offset: 2px;
        }
        .player-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .search-btn {
          background: none;
          border: none;
          color: var(--ink-color-text-muted, #71717a);
          padding: 10px;
          cursor: pointer;
          border-radius: 50%;
        }
        @media (hover: hover) {
          .search-btn:hover {
            background: var(--ink-border-subtle);
          }
        }
        .search-btn:active {
          background: var(--ink-border-subtle);
        }
        .search-btn svg {
          width: 22px;
          height: 22px;
        }

        /* Chat list - hidden scrollbar (smartphone-style) */
        .chat-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
          margin: 0;
          list-style: none;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .chat-list::-webkit-scrollbar {
          display: none;
        }

        /* Section headers */
        .section-header {
          padding: 20px 20px 10px;
          font-size: 0.7em;
          font-weight: 600;
          color: var(--ink-color-text-muted, #71717a);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .section-items {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        /* Chat items */
        .chat-item {
          list-style: none;
        }

        .chat-item-btn {
          display: flex;
          align-items: flex-start;
          width: 100%;
          padding: 10px 20px;
          cursor: pointer;
          transition: background-color 0.15s;
          background: none;
          border: none;
          text-align: left;
          font-family: inherit;
        }
        .chat-item-btn:focus {
          background: var(--ink-color-surface, #1e1e24);
        }
        @media (hover: hover) {
          .chat-item-btn:hover {
            background: var(--ink-color-surface, #1e1e24);
          }
        }
        .chat-item-btn:active {
          background: var(--ink-color-surface, #1e1e24);
        }
        .chat-item-btn:focus {
          outline: none;
        }
        .chat-item-btn:focus-visible {
          outline: 2px solid var(--ink-color-accent, #5b7cfa);
          outline-offset: -2px;
        }

        /* Avatar */
        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2em;
          font-weight: 300;
          margin-right: 16px;
          margin-top: 2px;
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

        /* Details */
        .details {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .title-row {
          display: flex;
          align-items: center;
          gap: var(--ink-space-sm, 8px);
        }
        .title {
          font-weight: 400;
          color: var(--ink-color-text, #f2f2f7);
          font-size: 1em;
          letter-spacing: -0.01em;
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .time {
          font-size: 0.8em;
          color: var(--ink-color-text-muted, #8e8e93);
          flex-shrink: 0;
        }
        .preview-row {
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }
        .preview {
          color: var(--ink-color-text-secondary, #ababab);
          font-size: 0.95em;
          line-height: 1.3;
          letter-spacing: -0.01em;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          word-break: break-word;
        }

        /* Status indicator — badge or receipt, collapses when empty */
        .status-indicator {
          flex-shrink: 0;
          display: none;
          align-items: flex-start;
          justify-content: flex-end;
          margin-top: 2px;
        }
        .status-indicator.visible {
          display: flex;
        }

        /* Preview receipt icon */
        .preview-receipt {
          display: inline-flex;
        }
        .preview-receipt[hidden] {
          display: none;
        }
        .preview-receipt svg {
          height: 14px;
          width: auto;
          color: var(--ink-color-text-muted, #8e8e93);
        }

        /* Unread badge */
        .unread-badge {
          width: 18px;
          height: 18px;
          padding: 0;
          background: var(--ink-color-accent, #0a84ff);
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75em;
          font-weight: 600;
          color: white;
        }
        .unread-badge[hidden] {
          display: none;
        }

        /* Bold title and time for unread chats */
        .chat-item.unread .title {
          font-weight: 500;
        }
        .chat-item.unread .time {
          font-weight: 500;
          color: var(--ink-color-text, #f2f2f7);
        }

        @media (prefers-reduced-motion: reduce) {
          .chat-item-btn {
            transition: none;
          }
        }
      </style>

      <header class="header">
        <div class="header-left">
          <span class="app-title">${getApp().name || 'Messages'}</span>
        </div>
        <div class="header-right">
          ${this.renderPlayerAvatar()}
          <button class="search-btn" aria-label="${t('hub.search')}" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
        </div>
      </header>

      <div class="chat-list">
        ${
          pinned.length > 0
            ? `
          <div class="section-header">${t('hub.pinned')}</div>
          <ul class="section-items" role="list">
            ${pinned.map((chat) => this.renderChatItem(chat)).join('')}
          </ul>
        `
            : ''
        }

        ${
          regular.length > 0
            ? `
          <div class="section-header">${t('hub.chats')}</div>
          <ul class="section-items" role="list">
            ${regular.map((chat) => this.renderChatItem(chat)).join('')}
          </ul>
        `
            : ''
        }
      </div>
    `;
  }
}

customElements.define('chat-hub', ChatHub);
