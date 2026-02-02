/**
 * chat-thread/index.js - Main conversation view orchestrator
 *
 * Coordinates sub-components for rendering chat conversations:
 * - chat-header: Title and presence status
 * - conversation-banner: Chat start display
 * - date-separator: Date dividers
 * - message-bubble: Individual messages (render functions)
 * - choice-buttons: Player response selection
 * - typing-indicator: Typing animation
 */

// Foundation services
import { eventBus } from '../../../../foundation/services/event-bus.js';
// Conversation system events
import { EVENTS } from '../../events/events.js';
import {
  getChat,
  getChatType,
  t,
} from '../../services/conversation-context.js';
import { createFocusTrap } from '../../utils/focus-trap.js';
import { wireGlossaryClicks, wireReadMoreToggles } from '../../utils/text.js';

// Import sub-components (registers custom elements)
import './chat-header.js';
import './choice-buttons.js';
import './conversation-banner.js';
import './date-separator.js';
import './unread-separator.js';
import '../audio-bubble.js';
import '../image-bubble.js';
import '../link-preview.js';
import '../typing-indicator.js';

// Import utilities
import { getDateLabel } from './date-separator.js';
import {
  escapeAttr,
  escapeHtml,
  MESSAGE_BUBBLE_STYLES,
  RECEIPT_ICONS,
  renderAudioBubble,
  renderImageBubble,
  renderLinkPreviewBubble,
  renderMessageBubble,
  renderMeta,
} from './message-bubble.js';
import { groupMessages } from './message-grouper.js';

/**
 * ChatThread - Conversation view web component (orchestrator)
 *
 * @element chat-thread
 * @fires {CustomEvent} thread-closed - When user navigates back to hub
 * @fires {CustomEvent} choice-selected - When user selects a response choice
 * @fires {CustomEvent} profile-clicked - When user clicks avatar/title to open profile settings
 */
export class ChatThread extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.messages = [];
    this.choices = [];
    this.chatId = null;
    this.title = '';
    this.presence = null;
    this._unsubscribers = [];
    // Image lightbox state (persists across message re-renders)
    this._previewImage = null; // { src, caption } or null
    this._focusTrap = null;
    this._escapeHandler = null;
    // Unread separator state (fixed at chat open time)
    this._unreadCount = 0;
    this._showUnreadSeparator = false;
    this._lastReadMessageId = null;
    // "Now" timestamp override — ID of message currently showing "Now"
    this._freshMessageId = null;
  }

  connectedCallback() {
    this.render();
    this.subscribeToEvents();

    // Suppress context menu to prevent "Save Image" and text selection menus
    this.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault();
      },
      { capture: true },
    );

    // Listen for image preview requests (bubbles from image-bubble with composed: true)
    this.addEventListener('image-preview-open', (e) => {
      const { src, caption } = e.detail;
      this.openImagePreview(src, caption);
    });
  }

  disconnectedCallback() {
    for (const unsub of this._unsubscribers) {
      unsub();
    }
    this._unsubscribers = [];

    // Clean up lightbox resources
    if (this._focusTrap) {
      this._focusTrap.deactivate();
      this._focusTrap = null;
    }
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
      this._escapeHandler = null;
    }
  }

  subscribeToEvents() {
    // Subscribe to new messages (only for current chat)
    this._unsubscribers.push(
      eventBus.on(EVENTS.MESSAGE_RECEIVED, (e) => {
        const { chatId, message } = e.detail;
        if (!this.hidden && this.chatId === chatId) {
          this.addMessage(message);
        }
      }),
    );

    // Subscribe to choices
    this._unsubscribers.push(
      eventBus.on(EVENTS.CHOICES_AVAILABLE, (e) => {
        if (!this.hidden) {
          this.setChoices(e.detail.choices);
        }
      }),
    );

    // Subscribe to typing indicators
    this._unsubscribers.push(
      eventBus.on(EVENTS.TYPING_START, (e) => {
        const { chatId, speaker } = e.detail;
        if (!this.hidden && this.chatId === chatId) {
          this.showTyping(speaker);
        }
      }),
    );

    this._unsubscribers.push(
      eventBus.on(EVENTS.TYPING_END, (e) => {
        const { chatId } = e.detail;
        if (!this.hidden && this.chatId === chatId) {
          this.hideTyping();
        }
      }),
    );

    // Subscribe to receipt changes (selective DOM update, no full re-render)
    this._unsubscribers.push(
      eventBus.on(EVENTS.MESSAGE_RECEIPT_CHANGED, (e) => {
        const { chatId, label, receipt } = e.detail;
        if (!this.hidden && this.chatId === chatId) {
          this.updateReceipt(label, receipt);
        }
      }),
    );

    // Subscribe to presence changes
    this._unsubscribers.push(
      eventBus.on(EVENTS.PRESENCE_CHANGED, (e) => {
        const { chatId, status } = e.detail;
        if (!this.hidden && this.chatId === chatId) {
          this.setPresence(status);
        }
      }),
    );
  }

  open(
    chatId,
    title,
    messages = [],
    lastReadMessageId = null,
    deferredCount = 0,
  ) {
    if (!chatId) {
      throw new Error('ChatThread.open: missing required chatId');
    }
    if (!title) {
      console.warn('ChatThread.open: missing title, using chatId');
      title = chatId;
    }

    this.chatId = chatId;
    this.title = title;
    this.messages = Array.isArray(messages) ? [...messages] : [];
    this.choices = [];
    this.presence = null;
    this.hidden = false;

    // Calculate unread count (including deferred messages that will replay)
    // Skip for diary-type chats (e.g., "My Notes") where user writes to self
    const chatConfig = getChat(chatId);
    const hideUnreadSeparator = chatConfig?.hideUnreadSeparator === true;

    this._lastReadMessageId = lastReadMessageId;
    // Track if separator should be shown (cleared on user interaction)
    // Show if lastReadMessageId is set AND chat allows it
    this._showUnreadSeparator = !!lastReadMessageId && !hideUnreadSeparator;
    // Canonical timestamps on re-entry (no "Now")
    this._freshMessageId = null;

    this.render();
    // Scroll to approximate position synchronously (safe — scrollTop doesn't
    // force a layout paint like scrollIntoView does).
    const container = this.shadowRoot.querySelector('.messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }

    // Return a finalize function that must be called AFTER the view transition.
    // scrollIntoView forces synchronous layout — calling it during the parallax
    // animation paints the element at rest position, causing an instant jump.
    // By returning the scroll as a deferred action, the contract is structural:
    // forgetting to call finalize() means the chat never scrolls to the unread
    // separator — a visible bug that gets caught immediately.
    return () => this.scrollToUnreadOrBottom();
  }

  close() {
    this._freshMessageId = null;
    this.hidden = true;
    this.dispatchEvent(new CustomEvent('thread-closed', { bubbles: true }));
  }

  addMessage(message) {
    if (message._isSeed) {
      // Seeded messages (backstory) must be inserted before non-seeded messages
      // Find insert position: after all existing seeded messages
      let insertIdx = 0;
      for (let i = 0; i < this.messages.length; i++) {
        if (this.messages[i]._isSeed) {
          insertIdx = i + 1;
        } else {
          break;
        }
      }
      this.messages.splice(insertIdx, 0, message);
    } else {
      this.messages.push(message);
      // Clear unread separator when new non-seeded message arrives
      // (deferred messages replaying or responses to user choices)
      this._showUnreadSeparator = false;
      // Mark as fresh — previous "Now" naturally reverts (only one ID stored)
      this._freshMessageId = message.id;
    }
    this.renderMessages();
    this.scrollToBottom();
  }

  /**
   * Selectively update a receipt icon without full re-render
   * @param {string} label - Message label to find
   * @param {string} receipt - New receipt state ('sent', 'delivered', 'read')
   */
  updateReceipt(label, receipt) {
    // Update in-memory message
    const msg =
      this.messages.find((m) => m.label === label) ||
      this.messages.find((m) => m.id === label);
    if (msg) {
      msg.receipt = receipt;
    }

    // Selective DOM update — find the meta element by label
    const container = this.shadowRoot.querySelector('.messages');
    if (!container) return;
    const metaEl =
      container.querySelector(`.meta[data-msg-label="${label}"]`) ||
      container.querySelector(`.meta[data-msg-id="${label}"]`);
    if (!metaEl) return;

    const receiptEl = metaEl.querySelector('.receipt-icon');
    if (receiptEl && RECEIPT_ICONS[receipt]) {
      // Add animation class, swap SVG
      receiptEl.classList.add('receipt-animate');
      receiptEl.innerHTML = RECEIPT_ICONS[receipt];
      receiptEl.addEventListener(
        'animationend',
        () => receiptEl.classList.remove('receipt-animate'),
        { once: true },
      );
    }
  }

  setChoices(choices) {
    this.choices = choices;
    const choiceButtons = this.shadowRoot.querySelector('choice-buttons');
    if (choiceButtons) {
      choiceButtons.setChoices(choices);
    }
    // Hide input bar when choices are present
    const inputBar = this.shadowRoot.querySelector('.input-bar');
    if (inputBar) {
      inputBar.hidden = choices.length > 0;
    }
  }

  clearChoices() {
    this.choices = [];
    const choiceButtons = this.shadowRoot.querySelector('choice-buttons');
    if (choiceButtons) {
      choiceButtons.clear();
    }
    // Show input bar when choices are cleared
    const inputBar = this.shadowRoot.querySelector('.input-bar');
    if (inputBar) {
      inputBar.hidden = false;
    }
  }

  setPresence(status) {
    if (status === 'typing') return;
    this.presence = status;
    const header = this.shadowRoot.querySelector('chat-header');
    if (header) {
      header.setPresence(status);
    }
  }

  showTyping(speaker) {
    const indicator = this.shadowRoot.querySelector('typing-indicator');
    if (indicator) {
      indicator.show(speaker);
    }
    this.scrollToBottom();
  }

  hideTyping() {
    const indicator = this.shadowRoot.querySelector('typing-indicator');
    if (indicator) {
      indicator.hide();
    }
  }

  scrollToBottom(smooth = true) {
    requestAnimationFrame(() => {
      const container = this.shadowRoot.querySelector('.messages');
      if (container) {
        const prefersReducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;
        const useSmooth = smooth && !prefersReducedMotion;

        if (useSmooth) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
          });
        } else {
          container.scrollTop = container.scrollHeight;
        }
      }
    });
  }

  scrollToUnreadOrBottom() {
    requestAnimationFrame(() => {
      const container = this.shadowRoot.querySelector('.messages');
      if (!container) return;

      // If separator is visible, scroll to it instead of bottom
      const separator = container.querySelector('unread-separator');
      if (separator) {
        separator.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  /**
   * Open image lightbox (persists across message re-renders)
   */
  openImagePreview(src, caption) {
    this._previewImage = { src, caption };
    this.renderLightbox();

    // Create and activate focus trap
    const lightbox = this.shadowRoot.querySelector('.image-lightbox');
    if (lightbox) {
      this._focusTrap = createFocusTrap(lightbox);
      this._focusTrap.activate();

      // Focus close button
      requestAnimationFrame(() => {
        lightbox.querySelector('.close-btn')?.focus();
      });
    }

    // Add escape handler
    this._escapeHandler = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        this.closeImagePreview();
      }
    };
    document.addEventListener('keydown', this._escapeHandler);
  }

  /**
   * Close image lightbox
   */
  closeImagePreview() {
    this._previewImage = null;

    // Clean up focus trap
    if (this._focusTrap) {
      this._focusTrap.deactivate();
      this._focusTrap = null;
    }

    // Clean up escape handler
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
      this._escapeHandler = null;
    }

    this.renderLightbox();
  }

  /**
   * Render lightbox overlay (called independently of message renders)
   */
  renderLightbox() {
    let lightbox = this.shadowRoot.querySelector('.image-lightbox');

    if (!this._previewImage) {
      // Remove lightbox if present
      if (lightbox) {
        lightbox.remove();
      }
      return;
    }

    const { src, caption } = this._previewImage;
    const escCaption = escapeAttr(caption);
    const escSrc = escapeAttr(src);

    const html = `
      <div class="image-lightbox" role="dialog" aria-label="${t('ui.a11y.image_preview')}">
        <div class="lightbox-header">
          <button class="close-btn" aria-label="${t('ui.a11y.close_image')}">×</button>
        </div>
        <img class="lightbox-image" src="${escSrc}" alt="${escCaption || 'Image message'}"/>
        ${caption ? `<div class="lightbox-caption">${escapeHtml(caption)}</div>` : ''}
      </div>
    `;

    if (!lightbox) {
      // Create container
      lightbox = document.createElement('div');
      lightbox.className = 'image-lightbox-container';
      this.shadowRoot.appendChild(lightbox);
    }

    lightbox.innerHTML = html;

    // Wire close button
    lightbox.querySelector('.close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeImagePreview();
    });

    // Wire backdrop click
    lightbox
      .querySelector('.image-lightbox')
      ?.addEventListener('click', (e) => {
        if (e.target.classList.contains('image-lightbox')) {
          this.closeImagePreview();
        }
      });
  }

  /**
   * Check if user can send messages in this chat
   */
  canSendMessages() {
    const chatConfig = getChat(this.chatId);
    if (!chatConfig) return true;

    const typeConfig = getChatType(chatConfig.chatType);
    return typeConfig?.canSend !== false;
  }

  /**
   * Get placeholder text for disabled input
   */
  getInputPlaceholder() {
    const chatConfig = getChat(this.chatId);
    if (!chatConfig) return '';

    const typeConfig = getChatType(chatConfig.chatType);
    const text = typeConfig?.inputPlaceholder || '';
    return text.replace('{name}', chatConfig.title || '');
  }

  /**
   * Render a single message (delegates to appropriate renderer)
   */
  renderSingleMessage(msg, isLast) {
    const isFresh = msg.id === this._freshMessageId;
    let html;
    // Use msg.kind discriminant for routing
    if (msg.kind === 'audio') {
      html = renderAudioBubble(msg);
    } else if (msg.kind === 'image') {
      html = renderImageBubble(msg);
    } else if (msg.kind === 'linkPreview') {
      html = renderLinkPreviewBubble(msg);
    } else {
      // text and attachment both use renderMessageBubble
      html = renderMessageBubble({ msg, isLast, chatId: this.chatId, isFresh });
    }
    // Meta (timestamp + receipt) is rendered by the orchestrator so every
    // message kind gets it automatically — no per-renderer wiring needed.
    // renderMessageBubble still handles its own meta because it renders
    // meta INSIDE a link-preview wrapper div when one is present.
    if (msg.kind !== 'text' && msg.kind !== 'attachment') {
      const displayMsg = isFresh ? { ...msg, time: t('time.now') } : msg;
      html += renderMeta(
        displayMsg,
        isLast,
        msg.type || 'received',
        this.chatId,
      );
    }
    return html;
  }

  renderMessages() {
    const container = this.shadowRoot.querySelector('.messages');
    if (!container) return;

    const allMessages = this.messages.filter((m) => !m._statusOnly);
    const groups = groupMessages(allMessages);

    // Use conversation-banner component
    let html = `<conversation-banner chat-id="${this.chatId}"></conversation-banner>`;

    let currentDateLabel = null;
    let separatorInserted = false;
    // If no lastReadId, consider all read. If '__BEFORE_ALL__', all messages are unread.
    let foundLastRead =
      !this._lastReadMessageId || this._lastReadMessageId === '__BEFORE_ALL__';

    // Calculate unread count dynamically (messages after lastReadMessageId)
    // Seeded messages (_isSeed: true) are backstory and always considered "read"
    let unreadCount = 0;
    if (this._showUnreadSeparator) {
      if (this._lastReadMessageId === '__BEFORE_ALL__') {
        // All non-seeded messages are unread
        unreadCount = allMessages.filter((m) => !m._isSeed).length;
      } else {
        const lastReadIdx = allMessages.findIndex(
          (m) => m.id === this._lastReadMessageId,
        );
        unreadCount =
          lastReadIdx >= 0 ? allMessages.length - lastReadIdx - 1 : 0;
      }
    }

    for (const group of groups) {
      const len = group.messages.length;
      for (let i = 0; i < len; i++) {
        const msg = group.messages[i];
        const isLast = i === len - 1;

        // Check for date change
        const msgDate = msg.date || (msg._isSeed ? null : '0');
        const dateLabel =
          msgDate === '0' ? t('dates.today') : getDateLabel(msgDate);

        if (dateLabel && dateLabel !== currentDateLabel) {
          html += `<date-separator label="${escapeHtml(dateLabel)}"></date-separator>`;
          currentDateLabel = dateLabel;
        }

        // Insert unread separator before first unread message
        // Skip seeded messages - they're backstory and always considered "read"
        if (
          this._showUnreadSeparator &&
          !separatorInserted &&
          foundLastRead &&
          msg.id !== this._lastReadMessageId &&
          !msg._isSeed &&
          unreadCount > 0
        ) {
          html += `<unread-separator count="${unreadCount}"></unread-separator>`;
          separatorInserted = true;
        }

        // Track when we pass the last read message
        if (msg.id === this._lastReadMessageId) {
          foundLastRead = true;
        }

        html += this.renderSingleMessage(msg, isLast);
      }
    }

    container.innerHTML = html;
    this.initializeAudioBubbles();
  }

  initializeAudioBubbles() {
    const audioBubbles = this.shadowRoot.querySelectorAll('audio-bubble');
    for (const bubble of audioBubbles) {
      const msgId = bubble.dataset.id;
      const transcript = bubble.dataset.transcript;

      if (transcript) {
        bubble.transcript = transcript;
      }

      const msg = this.messages.find((m) => m.id === msgId);
      if (msg?._transcriptRevealed) {
        bubble._revealed = true;
        bubble.render();
      }
    }
  }

  handleTranscriptRevealed(e) {
    const bubble = e.target;
    const msgId = bubble.dataset?.id;
    if (msgId) {
      const msg = this.messages.find((m) => m.id === msgId);
      if (msg) {
        msg._transcriptRevealed = true;
      }
    }
  }

  render() {
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

        /* Messages container */
        .messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: var(--ink-space-sm, 8px);
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .messages::-webkit-scrollbar {
          display: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .messages {
            scroll-behavior: auto;
          }
        }

        ${MESSAGE_BUBBLE_STYLES}

        /* Input bar (non-functional) */
        .input-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--ink-color-bg, #121216);
          border-top: 1px solid var(--ink-color-surface, #1e1e24);
          flex-shrink: 0;
        }
        .input-bar .input-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-color-text-muted, #71717a);
          flex-shrink: 0;
        }
        .input-bar .input-icon svg {
          width: 22px;
          height: 22px;
        }
        .input-bar .input-field {
          flex: 1;
          background: var(--ink-color-surface, #1e1e24);
          border: none;
          border-radius: 24px;
          padding: 10px 16px;
          color: var(--ink-color-text-secondary, #a1a1aa);
          font-size: 0.95em;
          outline: none;
        }
        .input-bar .send-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--ink-color-accent, #5b7cfa);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        .input-bar .send-btn svg {
          width: 18px;
          height: 18px;
        }

        .input-disabled {
          padding: 14px;
          background: var(--ink-color-bg, #121216);
          border-top: 1px solid var(--ink-color-surface, #1e1e24);
          color: var(--ink-color-text-muted, #71717a);
          font-size: 0.9em;
          text-align: center;
          flex-shrink: 0;
        }

        .input-bar[hidden] {
          display: none;
        }

        /* Image lightbox (owned by chat-thread, outside .messages) */
        .image-lightbox {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--ink-overlay-heavy, rgba(0, 0, 0, 0.9));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: var(--ink-space-lg, 20px);
        }

        .lightbox-header {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: flex-end;
          padding: var(--ink-space-md, 15px);
        }

        .image-lightbox .close-btn {
          width: 40px;
          height: 40px;
          border: none;
          background: var(--ink-hover-light, rgba(255, 255, 255, 0.1));
          color: white;
          border-radius: 50%;
          cursor: pointer;
          font-size: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color var(--ink-transition-fast, 0.1s);
        }

        .image-lightbox .close-btn:hover {
          background: var(--ink-hover-medium, rgba(255, 255, 255, 0.2));
        }

        .image-lightbox .close-btn:focus {
          outline: 2px solid white;
          outline-offset: 2px;
        }

        .lightbox-image {
          max-width: 100%;
          max-height: calc(100vh - 120px);
          object-fit: contain;
          border-radius: var(--ink-radius-button, 12px);
        }

        .lightbox-caption {
          margin-top: var(--ink-space-md, 15px);
          color: white;
          font-size: var(--ink-font-size-base, 16px);
          text-align: center;
          max-width: 80%;
        }

        @media (prefers-reduced-motion: reduce) {
          .image-lightbox .close-btn {
            transition: none;
          }
        }
      </style>

      <chat-header title="${escapeHtml(this.title)}" chat-id="${this.chatId}"></chat-header>

      <div class="messages" role="log" aria-live="polite" aria-label="${t('ui.a11y.message_history')}" tabindex="0"></div>

      <typing-indicator hidden></typing-indicator>

      <choice-buttons></choice-buttons>

      ${
        this.canSendMessages()
          ? `
      <div class="input-bar">
        <span class="input-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </span>
        <div class="input-field">Message</div>
        <span class="input-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </span>
        <span class="input-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </span>
        <button class="send-btn" aria-label="${t('ui.a11y.send_message')}">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 4l8 8-8 8v-6H4v-4h8V4z"/>
          </svg>
        </button>
      </div>
      `
          : `
      <div class="input-disabled">${this.getInputPlaceholder()}</div>
      `
      }
    `;

    this.renderMessages();

    if (this.presence) {
      this.setPresence(this.presence);
    }

    // Wire events
    this.shadowRoot
      .querySelector('chat-header')
      ?.addEventListener('back-clicked', () => {
        this.close();
      });

    this.shadowRoot
      .querySelector('chat-header')
      ?.addEventListener('profile-clicked', () => {
        this.dispatchEvent(
          new CustomEvent('profile-clicked', {
            detail: { chatId: this.chatId },
            bubbles: true,
          }),
        );
      });

    this.shadowRoot
      .querySelector('choice-buttons')
      ?.addEventListener('choice-selected', (e) => {
        this.dispatchEvent(
          new CustomEvent('choice-selected', {
            detail: e.detail,
            bubbles: true,
          }),
        );
        // Clear unread separator and "Now" override on user interaction
        const needsRerender = this._showUnreadSeparator || this._freshMessageId;
        this._showUnreadSeparator = false;
        this._freshMessageId = null;
        if (needsRerender) {
          this.renderMessages();
        }
        // Move focus to messages area after choice selection
        this.shadowRoot.querySelector('.messages')?.focus();
      });

    this.shadowRoot
      .querySelector('.messages')
      ?.addEventListener('transcript-revealed', (e) => {
        this.handleTranscriptRevealed(e);
      });

    wireGlossaryClicks(this.shadowRoot, this);
    wireReadMoreToggles(this.shadowRoot);

    // Restore lightbox if it was open before render
    if (this._previewImage) {
      this.renderLightbox();
    }
  }
}

customElements.define('chat-thread', ChatThread);
