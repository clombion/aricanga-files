// Notification Shade - Android-style notification shade with quick tiles
// Full screen overlay with blur, quick action tiles, and notifications

// Foundation services
import { eventBus } from '../../../foundation/services/event-bus.js';
import { EVENTS } from '../events/events.js';
import {
  getChat,
  getLocale,
  getUIStrings,
  I18N_EVENTS,
  t,
} from '../services/conversation-context.js';
import {
  DECELERATE_EASING,
  EMPHASIZED_EASING,
  EXIT_EASING,
} from '../utils/animation-constants.js';
import { renderAvatar } from '../utils/avatar.js';
import { escapeHtml } from '../utils/text.js';

export class NotificationDrawer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._notifications = [];
    this._isOpen = false;
    this._currentTheme = 'dark';
    this._onLocaleChanged = this._onLocaleChanged.bind(this);
    this._onThemeChanged = this._onThemeChanged.bind(this);
    this._unsubscribers = [];
  }

  get isOpen() {
    return this._isOpen;
  }

  connectedCallback() {
    // Get initial theme from DOM (set by theme-preferences.js)
    this._currentTheme =
      document.documentElement.getAttribute('data-theme') || 'dark';
    this.render();
    // Re-render on runtime locale switch (initial render is safe via deferred registration)
    eventBus.on(I18N_EVENTS.LOCALE_CHANGED, this._onLocaleChanged);
    // Listen for theme changes
    eventBus.on(EVENTS.THEME_CHANGED, this._onThemeChanged);

    // Drawer is SSOT for notification state - subscribe to NOTIFICATION_SHOW
    this._unsubscribers.push(
      eventBus.on(EVENTS.NOTIFICATION_SHOW, (e) => {
        const { chatId, preview } = e.detail;
        const chat = getChat(chatId);
        const title = chat?.title || chatId;
        const notification = {
          chatId,
          title,
          preview,
          avatarLetter: chat?.avatarLetter || title.charAt(0),
          avatarColor: chat?.avatarColor || '#6b8afd', // lint-ignore: fallback avatar color
          timestamp: Date.now(),
        };
        this.add(notification);
      }),
    );

    // Running animations for cleanup
    this._activeAnimations = [];
  }

  disconnectedCallback() {
    eventBus.off(I18N_EVENTS.LOCALE_CHANGED, this._onLocaleChanged);
    eventBus.off(EVENTS.THEME_CHANGED, this._onThemeChanged);
    for (const unsub of this._unsubscribers) {
      unsub();
    }
    this._unsubscribers = [];
  }

  _onLocaleChanged() {
    this.render();
  }

  _onThemeChanged(e) {
    this._currentTheme = e.detail.effectiveTheme;
    this.render();
  }

  /**
   * Add a notification to the drawer
   * @param {Object} notification - { chatId, title, preview, timestamp }
   */
  add(notification) {
    this._notifications.unshift(notification);
    this.render();
    this.dispatchEvent(
      new CustomEvent('drawer-count-changed', {
        detail: { count: this._notifications.length },
        bubbles: true,
      }),
    );
    // Emit for view-only consumers (popup, lockscreen)
    this.dispatchEvent(
      new CustomEvent('drawer-notification-added', {
        detail: notification,
        bubbles: true,
      }),
    );
  }

  /**
   * Get current notification count
   */
  get count() {
    return this._notifications.length;
  }

  /**
   * Get a shallow copy of current notifications (read-only view for consumers)
   * @returns {Array<Object>} Array of notification objects
   */
  get notifications() {
    return [...this._notifications];
  }

  /**
   * Open the drawer with entrance animation
   */
  open() {
    this._isOpen = true;
    this._animateOpen();
  }

  /**
   * Close the drawer with exit animation.
   * Returns a Promise that resolves when the close animation finishes.
   * Immediately blocks further interaction (pointer-events: none).
   * @returns {Promise<void>}
   */
  close() {
    this._isOpen = false;
    // Block clicks immediately — no async gap
    this.style.pointerEvents = 'none';
    return this._animateClose();
  }

  /**
   * Animate open/close without full re-render.
   * Re-renders are only triggered when content actually changes (add/remove notifications).
   */
  _animateOpen() {
    // Cancel any running animations
    for (const a of this._activeAnimations || []) {
      a.cancel();
    }
    this._activeAnimations = [];

    // Show immediately (explicit values override :host CSS)
    this.style.visibility = 'visible';
    this.style.pointerEvents = 'auto';

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reducedMotion) return;

    const backdrop = this.shadowRoot.querySelector('.backdrop');
    const shade = this.shadowRoot.querySelector('.shade');
    if (!backdrop || !shade) return;

    const EMPHASIZED = EMPHASIZED_EASING;
    const DECELERATE = DECELERATE_EASING;

    // Pre-hide elements so they don't flash at full opacity during stagger delays
    backdrop.style.opacity = '0';
    shade.style.opacity = '0';
    const tiles = this.shadowRoot.querySelectorAll('.tile');
    for (const tile of tiles) tile.style.opacity = '0';
    const notifSection = this.shadowRoot.querySelector(
      '.notifications-section',
    );
    if (notifSection) notifSection.style.opacity = '0';

    // Backdrop fade in
    this._activeAnimations.push(
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 350,
        easing: EMPHASIZED,
        fill: 'forwards',
      }),
    );

    // Shade slide down (must include translateX(-50%) to preserve CSS centering)
    this._activeAnimations.push(
      shade.animate(
        [
          { opacity: 0, transform: 'translateX(-50%) translateY(-40px)' },
          { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
        ],
        { duration: 450, easing: DECELERATE, fill: 'forwards' },
      ),
    );

    // Quick tiles stagger — opacity only, no transform to avoid snap-back
    tiles.forEach((tile, i) => {
      this._activeAnimations.push(
        tile.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 300,
          delay: i * 50,
          easing: DECELERATE,
          fill: 'forwards',
        }),
      );
    });

    // Notifications section fade in alongside shade — no extra delay
    if (notifSection) {
      this._activeAnimations.push(
        notifSection.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 450,
          easing: DECELERATE,
          fill: 'forwards',
        }),
      );
    }
  }

  /**
   * Run close exit animation. Returns Promise.
   * Safe against render() mid-animation (render cancels _activeAnimations).
   */
  async _animateClose() {
    // Cancel any open animations
    for (const a of this._activeAnimations) a.cancel();
    this._activeAnimations = [];

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (reducedMotion) {
      this._finalizeClose();
      return;
    }

    const backdrop = this.shadowRoot.querySelector('.backdrop');
    const shade = this.shadowRoot.querySelector('.shade');
    if (!backdrop || !shade) {
      this._finalizeClose();
      return;
    }

    const EXIT = EXIT_EASING;

    const shadeAnim = shade.animate(
      [
        { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
        { opacity: 0, transform: 'translateX(-50%) translateY(-20px)' },
      ],
      { duration: 300, easing: EXIT, fill: 'forwards' },
    );
    this._activeAnimations.push(shadeAnim);

    const backdropAnim = backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 260,
      easing: EXIT,
      fill: 'forwards',
    });
    this._activeAnimations.push(backdropAnim);

    try {
      await shadeAnim.finished;
    } catch {
      // Animation was cancelled (e.g. by render()) — that's fine
    }
    this._finalizeClose();
  }

  /** Synchronously set closed state — safe to call multiple times */
  _finalizeClose() {
    if (!this._isOpen) {
      this.style.visibility = 'hidden';
      this.style.pointerEvents = 'none';
    }
    for (const a of this._activeAnimations) a.cancel();
    this._activeAnimations = [];
  }

  /**
   * Clear a single notification by index
   */
  clearOne(index) {
    this._notifications.splice(index, 1);
    this.render();
    this.dispatchEvent(
      new CustomEvent('drawer-count-changed', {
        detail: { count: this._notifications.length },
        bubbles: true,
      }),
    );
  }

  /**
   * Remove notification(s) by chatId
   * @param {string} chatId - Chat ID to remove notifications for
   */
  remove(chatId) {
    const before = this._notifications.length;
    this._notifications = this._notifications.filter(
      (n) => n.chatId !== chatId,
    );
    if (this._notifications.length !== before) {
      this.render();
      this.dispatchEvent(
        new CustomEvent('drawer-count-changed', {
          detail: { count: this._notifications.length },
          bubbles: true,
        }),
      );
    }
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    this._notifications = [];
    this.render();
    this.dispatchEvent(
      new CustomEvent('drawer-count-changed', {
        detail: { count: 0 },
        bubbles: true,
      }),
    );
  }

  /**
   * Format timestamp for display using current locale
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(getLocale(), {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /**
   * Handle restart tile click
   */
  handleRestart() {
    if (
      confirm(
        `${getUIStrings().resetDialogTitle || 'Reset Game?'}\n\n${getUIStrings().resetDialogMessage || 'This will reset all progress.'}`,
      )
    ) {
      this.close();
      this.dispatchEvent(
        new CustomEvent('game-reset-requested', {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 2000;
          visibility: hidden;
          pointer-events: none;
        }

        .backdrop {
          position: absolute;
          inset: 0;
          background: var(--ink-overlay);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .shade {
          position: absolute;
          top: var(--ink-statusbar-height, 44px);
          left: 50%;
          transform: translateX(-50%);
          width: 90%;
          max-width: 360px;
          max-height: calc(85% - var(--ink-statusbar-height, 44px));
          background: var(--ink-surface-glass);
          border-radius: 0 0 var(--ink-radius-card, 16px) var(--ink-radius-card, 16px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Quick Tiles Section */
        .tiles-section {
          padding: var(--ink-space-md, 16px);
          border-bottom: 1px solid var(--ink-border-subtle);
        }

        .tiles-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--ink-space-sm, 10px);
        }

        .tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: var(--ink-tile-bg);
          border: none;
          border-radius: var(--ink-radius-card, 12px);
          padding: 14px 8px;
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: inherit;
        }

        @media (hover: hover) {
          .tile:hover:not(.disabled) {
            background: var(--ink-tile-hover);
          }
        }
        .tile:active:not(.disabled) {
          background: var(--ink-tile-hover);
        }

        .tile:focus {
          outline: 2px solid var(--ink-color-accent, #0a84ff);
          outline-offset: 2px;
        }

        .tile.disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .tile-icon {
          width: 24px;
          height: 24px;
          color: var(--ink-color-text, #f2f2f7);
        }

        .tile.restart .tile-icon {
          color: var(--ink-color-danger, #ff453a);
        }

        .tile-label {
          font-size: 0.75em;
          font-weight: 500;
          color: var(--ink-color-text-muted, #8e8e93);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tile:not(.disabled) .tile-label {
          color: var(--ink-color-text, #f2f2f7);
        }

        /* Notifications Section - hidden scrollbar (smartphone-style) */
        .notifications-section {
          flex: 1;
          overflow-y: auto;
          padding: var(--ink-space-md, 16px);
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .notifications-section::-webkit-scrollbar {
          display: none;
        }

        .section-header {
          font-size: 0.7em;
          font-weight: 600;
          color: var(--ink-color-text-muted, #71717a);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: var(--ink-space-sm, 10px);
        }

        .notifications {
          display: flex;
          flex-direction: column;
          gap: var(--ink-space-sm, 8px);
        }

        .notification-card {
          display: flex;
          align-items: stretch;
          background: var(--ink-card-bg);
          border-radius: var(--ink-radius-card, 12px);
          overflow: hidden;
        }

        .notification-card-btn {
          flex: 1;
          display: flex;
          align-items: flex-start;
          gap: var(--ink-space-sm, 12px);
          background: none;
          border: none;
          padding: var(--ink-space-sm, 12px);
          cursor: pointer;
          transition: background 0.15s ease;
          text-align: left;
          font-family: inherit;
          min-width: 0;
        }

        @media (hover: hover) {
          .notification-card-btn:hover {
            background: var(--ink-card-hover);
          }
        }
        .notification-card-btn:active {
          background: var(--ink-card-hover);
        }

        .notification-card-btn:focus {
          outline: 2px solid var(--ink-color-accent, #0a84ff);
          outline-offset: -2px;
        }

        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 300;
          font-size: 0.9em;
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

        .content {
          flex: 1;
          min-width: 0;
        }

        .sender {
          color: var(--ink-color-text, #f2f2f7);
          font-weight: 600;
          font-size: 0.9em;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .preview {
          color: var(--ink-color-text-muted, #8e8e93);
          font-size: 0.85em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .time {
          color: var(--ink-color-text-muted, #8e8e93);
          font-size: 0.75em;
          flex-shrink: 0;
        }

        .clear-one-btn {
          background: none;
          border: none;
          color: var(--ink-color-text-muted, #8e8e93);
          font-size: 1.2em;
          cursor: pointer;
          padding: 12px 12px 12px 4px;
          line-height: 1;
          flex-shrink: 0;
          transition: background 0.15s ease;
        }

        @media (hover: hover) {
          .clear-one-btn:hover {
            color: var(--ink-color-text, #f2f2f7);
            background: var(--ink-card-hover);
          }
        }
        .clear-one-btn:active {
          color: var(--ink-color-text, #f2f2f7);
          background: var(--ink-card-hover);
        }

        .clear-one-btn:focus {
          outline: 2px solid var(--ink-color-accent, #0a84ff);
          outline-offset: -2px;
        }

        .empty {
          color: var(--ink-color-text-muted, #8e8e93);
          text-align: center;
          padding: var(--ink-space-lg, 24px);
          font-size: 0.9em;
        }

        /* Bottom Bar */
        .bottom-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--ink-space-sm, 10px) var(--ink-space-md, 16px);
          border-top: 1px solid var(--ink-border-subtle);
          background: var(--ink-bar-bg);
        }

        .bottom-btn {
          background: none;
          border: none;
          color: var(--ink-color-text-muted, #8e8e93);
          padding: 8px;
          cursor: pointer;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (hover: hover) {
          .bottom-btn:hover:not(.disabled) {
            background: var(--ink-hover-light);
            color: var(--ink-color-text, #f2f2f7);
          }
        }
        .bottom-btn:active:not(.disabled) {
          background: var(--ink-hover-light);
          color: var(--ink-color-text, #f2f2f7);
        }

        .bottom-btn.disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .bottom-btn svg {
          width: 20px;
          height: 20px;
        }

        .clear-all-btn {
          background: var(--ink-border-subtle);
          border: none;
          border-radius: var(--ink-radius-button, 20px);
          padding: 8px 20px;
          color: var(--ink-color-text, #f2f2f7);
          font-size: 0.85em;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
        }

        @media (hover: hover) {
          .clear-all-btn:hover {
            background: var(--ink-hover-medium);
          }
        }
        .clear-all-btn:active {
          background: var(--ink-hover-medium);
        }

        .clear-all-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        @media (prefers-reduced-motion: reduce) {
          .tile, .notification-card-btn, .clear-one-btn {
            transition: none;
          }
        }
        /* Firefox: backdrop-filter causes blurry text with border-radius */
        @-moz-document url-prefix() {
          .backdrop {
            backdrop-filter: none;
          }
        }
      </style>

      <div class="backdrop" aria-hidden="true"></div>
      <div class="shade" role="dialog" aria-label="${t('a11y.notification_shade')}">
        <!-- Quick Tiles -->
        <div class="tiles-section">
          <div class="tiles-grid">
            <button class="tile restart" data-action="restart" aria-label="${t('tiles.restart')}">
              <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/>
                <line x1="12" y1="2" x2="12" y2="12"/>
              </svg>
              <span class="tile-label">${t('tiles.restart')}</span>
            </button>
            <button class="tile" data-action="glossary" aria-label="${t('tiles.glossary')}" data-testid="glossary-tile">
              <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <span class="tile-label">${t('tiles.glossary')}</span>
            </button>
            <button class="tile" data-action="settings" aria-label="${t('tiles.settings')}" data-testid="settings-tile">
              <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span class="tile-label">${t('tiles.settings')}</span>
            </button>
            <button class="tile" data-action="about" aria-label="${t('tiles.about')}" data-testid="about-tile">
              <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
              <span class="tile-label">${t('tiles.about')}</span>
            </button>
          </div>
        </div>

        <!-- Notifications -->
        <div class="notifications-section">
          <div class="section-header">${t('drawer.notifications')}</div>
          <div class="notifications">
            ${
              this._notifications.length === 0
                ? `<div class="empty">${t('drawer.no_notifications')}</div>`
                : this._notifications
                    .map(
                      (n, i) => `
                <div class="notification-card">
                  <button class="notification-card-btn" data-index="${i}" data-chat-id="${n.chatId}" aria-label="${escapeHtml(n.title)}: ${escapeHtml(n.preview)}">
                    ${this.renderNotificationAvatar(n)}
                    <div class="content">
                      <div class="sender">${escapeHtml(n.title)}</div>
                      <div class="preview">${escapeHtml(n.preview)}</div>
                    </div>
                    <span class="time">${this.formatTime(n.timestamp)}</span>
                  </button>
                  <button class="clear-one-btn" data-index="${i}" aria-label="${t('a11y.clear_notification')}">×</button>
                </div>
              `,
                    )
                    .join('')
            }
          </div>
        </div>

        <!-- Bottom Bar -->
        <div class="bottom-bar">
          <button class="bottom-btn lock-screen-btn" aria-label="Return to lock screen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </button>
          <button class="clear-all-btn" ${this._notifications.length === 0 ? 'disabled' : ''}>
            ${t('drawer.clear_all')}
          </button>
          <button class="bottom-btn theme-toggle-btn" aria-label="${t('tiles.theme_toggle')}">
            ${
              this._currentTheme === 'dark'
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>`
            }
          </button>
        </div>
      </div>
    `;

    this.wireEventHandlers();

    // Re-render rebuilds shadow DOM — cancel animations referencing old nodes
    for (const a of this._activeAnimations || []) a.cancel();
    this._activeAnimations = [];

    // Restore visibility state after re-render
    if (this._isOpen) {
      this.style.visibility = 'visible';
      this.style.pointerEvents = 'auto';
    } else {
      this.style.visibility = 'hidden';
      this.style.pointerEvents = 'none';
    }
  }

  wireEventHandlers() {
    // Backdrop close
    this.shadowRoot
      .querySelector('.backdrop')
      ?.addEventListener('click', () => this.close());

    // Tile clicks — await close() before dispatching navigation events
    this.shadowRoot.querySelectorAll('.tile:not(.disabled)').forEach((tile) => {
      tile.addEventListener('click', async () => {
        const action = tile.dataset.action;
        if (action === 'restart') {
          this.handleRestart();
        } else if (action === 'settings') {
          await this.close();
          this.dispatchEvent(
            new CustomEvent('settings-requested', {
              bubbles: true,
              composed: true,
            }),
          );
        } else if (action === 'about') {
          await this.close();
          this.dispatchEvent(
            new CustomEvent('about-requested', {
              bubbles: true,
              composed: true,
            }),
          );
        } else if (action === 'glossary') {
          await this.close();
          this.dispatchEvent(
            new CustomEvent('glossary-requested', {
              bubbles: true,
              composed: true,
            }),
          );
        }
      });
    });

    // Clear all
    this.shadowRoot
      .querySelector('.clear-all-btn')
      ?.addEventListener('click', () => this.clearAll());

    // Notification card button clicks (native button handles Enter/Space)
    this.shadowRoot
      .querySelectorAll('.notification-card-btn')
      .forEach((btn) => {
        btn.addEventListener('click', async () => {
          const chatId = btn.dataset.chatId;
          const index = Number.parseInt(btn.dataset.index, 10);
          this.clearOne(index);
          await this.close();
          this.dispatchEvent(
            new CustomEvent('notification-clicked', {
              detail: { chatId },
              bubbles: true,
            }),
          );
        });
      });

    // Lock screen button
    this.shadowRoot
      .querySelector('.lock-screen-btn')
      ?.addEventListener('click', async () => {
        await this.close();
        this.dispatchEvent(
          new CustomEvent('lockscreen-requested', {
            detail: { notifications: [...this._notifications] },
            bubbles: true,
            composed: true,
          }),
        );
      });

    // Theme toggle button
    this.shadowRoot
      .querySelector('.theme-toggle-btn')
      ?.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('theme-toggle-requested', {
            bubbles: true,
            composed: true,
          }),
        );
      });

    // Clear one buttons
    this.shadowRoot.querySelectorAll('.clear-one-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = Number.parseInt(btn.dataset.index, 10);
        this.clearOne(index);
      });
    });

    // Escape key to close
    this.shadowRoot
      .querySelector('.shade')
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.close();
        }
      });
  }

  /**
   * Render avatar for a notification, resolving chat config when available.
   */
  renderNotificationAvatar(notification) {
    const config = getChat(notification.chatId);
    return renderAvatar(config || { title: notification.title });
  }
}

customElements.define('notification-drawer', NotificationDrawer);
