/**
 * notification-popup.js - iOS-style slide-in alerts with stacking support
 *
 * View-only layer: displays notification banners from drawer-notification-added events.
 * The notification-drawer is the single source of truth for notification state.
 * This component only handles visual display and user interactions (click/dismiss).
 */

import { getApp, getUITiming, t } from '../services/conversation-context.js';
import { escapeHtml } from '../utils/text.js';

const MAX_VISIBLE_NOTIFICATIONS = 3;

/**
 * NotificationPopup - Stacking notification alerts (view-only)
 *
 * @element notification-popup
 * @fires {CustomEvent} notification-clicked - When user taps notification to open chat
 * @fires {CustomEvent} notification-dismissed - When user dismisses notification
 */
export class NotificationPopup extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._notifications = []; // Array of { id, data, timer }
    this._nextId = 0;
    this._boundOnDrawerNotification = this._onDrawerNotification.bind(this);
  }

  connectedCallback() {
    this.render();
    // Listen to drawer events (drawer is SSOT for notification state)
    document.addEventListener(
      'drawer-notification-added',
      this._boundOnDrawerNotification,
    );
  }

  disconnectedCallback() {
    // Clear all timers
    for (const n of this._notifications) {
      clearTimeout(n.timer);
    }
    document.removeEventListener(
      'drawer-notification-added',
      this._boundOnDrawerNotification,
    );
  }

  _onDrawerNotification(e) {
    const { chatId, title, preview, avatarLetter, avatarColor, timestamp } =
      e.detail;

    // Don't show popup while lockscreen is visible - it has its own notifications
    const root = this.getRootNode();
    const lockScreen = root.querySelector('lock-screen');
    if (lockScreen && !lockScreen.hidden) {
      return;
    }

    this.show(chatId, title, preview, avatarLetter, avatarColor, timestamp);
  }

  show(chatId, title, preview, avatarLetter, avatarColor, timestamp) {
    // Validate required params
    if (!chatId) {
      console.error('NotificationPopup.show: missing chatId');
      return;
    }
    if (!preview) {
      console.warn('NotificationPopup.show: empty preview');
      preview = '...';
    }

    const id = this._nextId++;
    const data = {
      chatId,
      title: title || chatId,
      preview,
      avatarLetter: avatarLetter || (title || chatId).charAt(0),
      avatarColor: avatarColor || '#6b8afd', // lint-ignore: fallback avatar color
      timestamp: timestamp || Date.now(),
    };

    // Stagger new notifications if others are showing
    const delay =
      this._notifications.length > 0
        ? (getUITiming('notificationStagger') ?? 0)
        : 0;

    setTimeout(() => {
      this._addNotification(id, data);
    }, delay);
  }

  _addNotification(id, data) {
    const notification = {
      id,
      data,
      timer: null,
    };

    // Evict oldest if at max capacity
    if (this._notifications.length >= MAX_VISIBLE_NOTIFICATIONS) {
      this._evictOldest();
    }

    this._notifications.push(notification);
    this._renderNotifications();

    // Auto-hide after configured timeout
    notification.timer = setTimeout(() => {
      this._autoHide(id);
    }, getUITiming('notificationAutoHide') ?? 5000);
  }

  _evictOldest() {
    const oldest = this._notifications[0];
    if (!oldest) return;

    const popup = this.shadowRoot.querySelector(`[data-id="${oldest.id}"]`);
    if (popup) {
      popup.classList.add('evicting');

      const handleAnimationEnd = () => {
        // Notification already in drawer - just remove visual
        clearTimeout(oldest.timer);
        this._notifications.shift();
        this._renderNotifications();
      };

      // Use animationend or immediate for reduced motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        handleAnimationEnd();
      } else {
        popup.addEventListener('animationend', handleAnimationEnd, {
          once: true,
        });
      }
    } else {
      // No DOM element yet, just remove
      clearTimeout(oldest.timer);
      this._notifications.shift();
    }
  }

  _autoHide(id) {
    // Notification already in drawer - just remove visual
    this._removeNotification(id);
  }

  _removeNotification(id) {
    const index = this._notifications.findIndex((n) => n.id === id);
    if (index === -1) return;

    clearTimeout(this._notifications[index].timer);
    this._notifications.splice(index, 1);
    this._renderNotifications();
  }

  _handleClick(id) {
    const notification = this._notifications.find((n) => n.id === id);
    if (!notification) return;

    // Dispatch click event (main.js handles navigation and drawer removal)
    this.dispatchEvent(
      new CustomEvent('notification-clicked', {
        detail: { chatId: notification.data.chatId },
        bubbles: true,
      }),
    );
    this._removeNotification(id);
  }

  _handleDismiss(id) {
    // Just remove visual - notification stays in drawer
    this.dispatchEvent(
      new CustomEvent('notification-dismissed', { bubbles: true }),
    );
    this._removeNotification(id);
  }

  // Legacy API compatibility
  get currentNotification() {
    return this._notifications[0]?.data || null;
  }

  dismiss() {
    if (this._notifications.length > 0) {
      this._removeNotification(this._notifications[0].id);
    }
  }

  _renderNotifications() {
    const container = this.shadowRoot.querySelector('.notifications-container');
    if (!container) return;

    const total = this._notifications.length;
    container.innerHTML = this._notifications
      .map(
        (n, index) => `
      <div class="popup show"
           data-id="${n.id}"
           role="alert"
           aria-live="assertive"
           tabindex="0"
           aria-label="${t('ui.a11y.new_message_notification')} ${index + 1} of ${total}"
           style="--stack-index: ${index}">
        <button class="dismiss-btn" data-id="${n.id}" aria-label="${t('ui.a11y.dismiss_notification')}">×</button>
        <div class="header">${getApp().gameTitle || 'Message'}</div>
        <div class="content">
          <span class="sender">${escapeHtml(n.data.title)}</span>: <span class="preview">${escapeHtml(n.data.preview)}</span>
        </div>
      </div>
    `,
      )
      .join('');

    // Delegated event handlers on container (single listener per event type)
    container.addEventListener('click', (e) => {
      const dismiss = e.target.closest('.dismiss-btn');
      if (dismiss) {
        e.stopPropagation();
        const id = Number.parseInt(dismiss.dataset.id, 10);
        this._handleDismiss(id);
        return;
      }
      const popup = e.target.closest('.popup');
      if (popup) {
        const id = Number.parseInt(popup.dataset.id, 10);
        this._handleClick(id);
      }
    });

    container.addEventListener('keydown', (e) => {
      const popup = e.target.closest('.popup');
      if (!popup) return;
      const id = Number.parseInt(popup.dataset.id, 10);
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._handleClick(id);
      }
      if (e.key === 'Escape') {
        this._handleDismiss(id);
      }
    });
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          width: 90%;
          max-width: 380px;
          pointer-events: none;
        }
        .notifications-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .popup {
          position: relative;
          background: var(--ink-surface-glass);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 15px;
          padding-right: 35px;
          box-shadow: 0 4px 15px var(--ink-shadow);
          cursor: pointer;
          opacity: 0;
          transform: translateY(-20px);
          transition: opacity 0.3s ease, transform 0.3s ease;
          pointer-events: none;
          animation: slideIn 0.3s ease forwards;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideOutLeft {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(-100%);
          }
        }
        .popup.evicting {
          animation: slideOutLeft 0.3s ease forwards;
          pointer-events: none;
        }
        .dismiss-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          color: var(--ink-text-muted, #8e8e93);
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
          line-height: 1;
          border-radius: 4px;
        }
        @media (hover: hover) {
          .dismiss-btn:hover {
            color: var(--ink-text, #f2f2f7);
            background: var(--ink-hover-light);
          }
        }
        .dismiss-btn:active {
          color: var(--ink-text, #f2f2f7);
          background: var(--ink-hover-light);
        }
        .popup.show {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        .popup:focus {
          outline: 2px solid var(--ink-primary, #0a84ff);
          outline-offset: 2px;
        }
        .header {
          font-size: 0.85em;
          font-weight: 600;
          color: var(--ink-text-muted, #8e8e93);
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .header::before {
          content: '💬';
          font-size: 1em;
        }
        .content {
          color: var(--ink-text, #f2f2f7);
          font-size: 0.95em;
          line-height: 1.3;
          overflow: hidden;
        }
        .sender {
          font-weight: 600;
          display: inline-block;
          max-width: 150px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          vertical-align: bottom;
        }
        .preview {
          color: var(--ink-text-muted, #8e8e93);
        }

        @media (prefers-reduced-motion: reduce) {
          .popup {
            transition: opacity 0.1s;
            animation: none;
            opacity: 1;
            transform: translateY(0);
          }
          .popup.evicting {
            animation: none;
            opacity: 0;
          }
        }
        /* Firefox: backdrop-filter causes blurry text with border-radius */
        @-moz-document url-prefix() {
          .popup {
            backdrop-filter: none;
          }
        }
      </style>
      <div class="notifications-container"></div>
    `;
  }
}

customElements.define('notification-popup', NotificationPopup);
