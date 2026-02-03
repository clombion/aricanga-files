/**
 * lock-screen-notifications.js - Notification card stack for lock screen
 *
 * Manages notification rendering, stacking, expand/collapse animations,
 * and the scrim overlay. Extracted from lock-screen.js (TASK-136).
 */

import {
  DECELERATE_EASING,
  DURATION_ELABORATE,
  DURATION_FAST,
  DURATION_QUICK,
  EXIT_EASING,
  STAGGER_TIGHT,
} from '../utils/animation-constants.js';

const CARD_SETTLE_TIMEOUT = 850;
const INTER_CARD_DELAY = 150;
const CARD_ENTRANCE_MS = 800;
const STACK_EXPAND_STAGGER = 40;
const STACK_SHADOW_TRANSITION_MS = 350;
export const SCRIM_TRANSITION_MS = 300;

export class LockScreenNotifications {
  /**
   * @param {ShadowRoot} shadowRoot
   * @param {object} deps - Injected dependencies
   * @param {Function} deps.escapeHtml
   * @param {Function} deps.renderAvatar
   * @param {Function} deps.getLocale
   * @param {Function} deps.t
   */
  constructor(shadowRoot, { escapeHtml, renderAvatar, getLocale, t }) {
    this._shadowRoot = shadowRoot;
    this._escapeHtml = escapeHtml;
    this._renderAvatar = renderAvatar;
    this._getLocale = getLocale;
    this._t = t;

    // State
    this._notifications = [];
    this._maxVisible = 3;
    this._maxExpandedVisible = 5;
    this._expanded = false;
    this._activeAnims = [];
    this._pendingNotifs = [];
    this._wakeFlushed = false;
    this._animationLock = Promise.resolve();
  }

  /** Whether the stack is currently expanded */
  get expanded() {
    return this._expanded;
  }

  /** Current notification count */
  get count() {
    return this._notifications.length;
  }

  /** Set notifications array directly (for show() initial render) */
  setNotifications(notifications) {
    this._notifications = [...notifications];
  }

  /** Reset all notification state (called from show()) */
  reset() {
    this._notifications = [];
    this.cancelActiveAnims();
    this._expanded = false;
    this._wakeFlushed = true; // Stack already rendered, no wake gate
    this._pendingNotifs = [];
    this._animationLock = Promise.resolve();
  }

  /**
   * Add a notification to display.
   * @param {object} notif
   * @param {Promise} wakeReady - Wake gate promise
   */
  add(notif, wakeReady) {
    this._notifications.push(notif);

    // After initial wake flush, show notifications immediately with
    // per-card entrance animation
    if (this._wakeFlushed) {
      wakeReady.then(() => this._showNotification(notif));
      return;
    }

    // During wake: queue notifications and flush them together so
    // multiple arrivals render as one smooth stack entrance.
    if (!this._pendingNotifs) this._pendingNotifs = [];
    this._pendingNotifs.push(notif);

    // Only schedule one flush per gate
    if (this._pendingNotifs.length === 1) {
      wakeReady.then(() => this._flushPendingNotifications());
    }
  }

  /**
   * Flush all notifications that queued during the wake gate.
   * Renders them as a complete stack and animates the stack in
   * with the same fade+translateY as other lock screen elements.
   */
  async _flushPendingNotifications() {
    this._wakeFlushed = true;
    const pending = this._pendingNotifs || [];
    this._pendingNotifs = [];
    if (pending.length === 0) return;

    // Render all pending notifications into the stack.
    // _showNotification chains on _animationLock (microtask), so we must
    // await the lock to ensure DOM is ready before animating.
    for (const notif of pending) {
      this._showNotification(notif, true /* skipAnimation */);
    }
    await this._animationLock;

    // Animate the whole stack in with wake-style entrance
    // Matches the gentle feel of clock/date/fingerprint stagger animations
    const stack = this._shadowRoot.querySelector('.notification-stack');
    if (!stack || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;

    stack.style.opacity = '0';
    const DECELERATE = DECELERATE_EASING;
    const anim = stack.animate(
      [
        { opacity: 0, transform: 'scale(0.92)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: DURATION_ELABORATE, easing: DECELERATE, fill: 'forwards' },
    );
    anim.finished
      .then(() => {
        anim.commitStyles();
        anim.cancel();
        stack.style.opacity = '';
      })
      .catch(() => {
        /* cancelled */
      });
  }

  /**
   * Seed lock screen with existing notifications (e.g. from drawer on refresh).
   * @param {Array<Object>} notifications
   */
  seed(notifications) {
    if (this._notifications.length > 0 || notifications.length === 0) return;
    for (const notif of notifications) {
      this._notifications.push(notif);
      this._showNotification(notif);
    }
  }

  /** Queue and render a notification card with choreographed entrance */
  _showNotification(notif, skipAnimation = false) {
    this._animationLock = this._animationLock.then(() =>
      this._showNotificationInner(notif, skipAnimation),
    );
    return this._animationLock;
  }

  async _showNotificationInner(notif, skipAnimation) {
    const stack = this._shadowRoot.querySelector('.notification-stack');
    if (!stack) {
      this._renderNotificationStack(notif, skipAnimation);
      return;
    }

    const cardsContainer = stack.querySelector('.notification-cards');
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (skipAnimation || reducedMotion) {
      this._reindexCards(cardsContainer);
      this._pruneOverflow(cardsContainer);
      const wrapper = this._createCardElement(notif, 0);
      wrapper.classList.remove('entering');
      cardsContainer.prepend(wrapper);
      this._updateStackDepthClass(cardsContainer);
      this._updateOverflowBadge(stack);
      return;
    }

    // --- Choreographed entrance ---

    // 1. Reindex + prune (BEFORE prepend — preserves original call order)
    this._reindexCards(cardsContainer);
    this._pruneOverflow(cardsContainer);

    // 2. Prepend new card (has 'entering' class from _createCardElement)
    const wrapper = this._createCardElement(notif, 0);
    cardsContainer.prepend(wrapper);

    // 3. Update stack depth — box-shadow shown immediately (transition: none on entering card)
    this._updateStackDepthClass(cardsContainer);
    this._updateOverflowBadge(stack);

    // 4. Wait for card settle animation, then cleanup
    const card = wrapper.querySelector('.notification-card');
    await new Promise((resolve) => {
      (card || wrapper).addEventListener('animationend', resolve, {
        once: true,
      });
      setTimeout(resolve, CARD_SETTLE_TIMEOUT); // Safety timeout (BUG-003 pattern)
    });

    wrapper.classList.remove('entering');

    // 5. Stagger delay before next queued notification
    await new Promise((r) => setTimeout(r, INTER_CARD_DELAY));
  }

  /** Create the notification stack container for the first notification */
  _renderNotificationStack(notif, skipAnimation = false) {
    const content = this._shadowRoot.querySelector('.content');
    const bottomSection = this._shadowRoot.querySelector('.bottom-section');
    if (!content) return;

    const stack = document.createElement('div');
    stack.className = 'notification-stack';

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'notification-cards';
    stack.appendChild(cardsContainer);

    const wrapper = this._createCardElement(notif, 0);
    if (skipAnimation) wrapper.classList.remove('entering');
    cardsContainer.appendChild(wrapper);

    // Insert before the bottom section (fingerprint area)
    content.insertBefore(stack, bottomSection);

    // Attach delegated click handler (stack created dynamically)
    if (this._onCardClick) this._wireClickHandlerInternal(stack);

    if (!skipAnimation) {
      wrapper.addEventListener(
        'animationend',
        () => wrapper.classList.remove('entering'),
        { once: true },
      );
    }
  }

  /** Bump data-stacked index on existing cards (0→1, 1→2, etc.) */
  _reindexCards(stack) {
    const wrappers = stack.querySelectorAll('.notification-card-wrapper');
    for (const w of wrappers) {
      const card = w.querySelector('.notification-card');
      if (!card) continue;
      const current = parseInt(card.dataset.stacked, 10);
      card.dataset.stacked = String(current + 1);
    }
  }

  /** Remove card wrappers that exceed _maxVisible */
  _pruneOverflow(stack) {
    const wrappers = stack.querySelectorAll('.notification-card-wrapper');
    for (let i = this._maxVisible; i < wrappers.length; i++) {
      wrappers[i].remove();
    }
  }

  /** Update stack-depth class on .notification-cards for box-shadow styling */
  _updateStackDepthClass(cardsContainer) {
    cardsContainer.classList.remove('stack-2', 'stack-3');
    const count = this._notifications.length;
    if (count === 2) cardsContainer.classList.add('stack-2');
    else if (count >= 3) cardsContainer.classList.add('stack-3');
  }

  /** Update or create/remove the "+N more" overflow badge */
  _updateOverflowBadge(stack) {
    const overflow = this._notifications.length - this._maxVisible;
    let badge = stack.querySelector('.notification-overflow');

    if (overflow > 0) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'notification-overflow';
        stack.appendChild(badge);
      }
      badge.textContent = `+${overflow} more`;
    } else if (badge) {
      badge.remove();
    }
  }

  /** Create a wrapper div containing an animated notification card */
  _createCardElement(notif, stackIndex) {
    const wrapper = document.createElement('div');
    wrapper.className = 'notification-card-wrapper entering';
    wrapper.innerHTML = `
      <button type="button" class="notification-card" data-stacked="${stackIndex}"
           aria-label="Notification from ${this._escapeHtml(notif.title)}">
        ${this._renderAvatar({ title: notif.title, avatarColor: notif.avatarColor, avatarLetter: notif.avatarLetter }, { cssClass: 'notification-avatar' })}
        <div class="notification-content">
          <div class="notification-header">
            <span class="notification-title">${this._escapeHtml(notif.title)}</span>
            <span class="notification-time">${this._formatNotificationTime(notif.timestamp)}</span>
          </div>
          <div class="notification-body">${this._escapeHtml(notif.preview)}</div>
        </div>
        <div class="notification-expand">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </button>
    `;
    return wrapper;
  }

  /**
   * Format notification timestamp for display.
   * Shows "now" if within last minute, otherwise shows time.
   */
  _formatNotificationTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    // Within last minute = "now"
    if (diff < 60000) {
      return 'now';
    }

    // Otherwise show time like "5:06 PM"
    return new Date(timestamp).toLocaleTimeString(this._getLocale(), {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /**
   * Attach delegated click handler to notification stack.
   * @param {Element} stack
   * @param {Function} onBounceFingerprint - Callback for fingerprint bounce
   */
  wireClickHandler(stack, onBounceFingerprint) {
    this._onCardClick = onBounceFingerprint;
    this._wireClickHandlerInternal(stack);
  }

  _wireClickHandlerInternal(stack) {
    const onBounce = this._onCardClick;
    stack.addEventListener('click', (e) => {
      if (!e.target.closest('.notification-card')) return;
      e.stopPropagation();
      if (this._expanded) {
        onBounce();
      } else if (this._notifications.length > 1) {
        this.expandStack(stack);
      } else {
        onBounce();
      }
    });
  }

  expandStack(stack) {
    // Cancel any in-flight collapse animations
    this.cancelActiveAnims();

    this._expanded = true;
    // Add class to host element (lock-screen) for status-bar scrim
    this._shadowRoot.host.classList.add('stack-expanded');
    stack.classList.add('expanded');
    this._showScrim();

    // Show up to _maxExpandedVisible cards
    const visible = this._notifications.slice(0, this._maxExpandedVisible);
    const overflow = this._notifications.length - this._maxExpandedVisible;

    // Rebuild cards in expanded layout
    stack.innerHTML = '';
    const SPRING = 'cubic-bezier(0.175, 0.885, 0.32, 1.1)';
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    this._activeAnims = [];
    for (let i = 0; i < visible.length; i++) {
      const wrapper = this._createCardElement(visible[i], i);
      wrapper.classList.remove('entering');
      const card = wrapper.querySelector('.notification-card');
      card.dataset.stacked = String(i);
      stack.appendChild(wrapper);

      if (!reducedMotion) {
        // Pre-hide staggered cards (WAAPI delay doesn't hide elements)
        if (i > 0) card.style.opacity = '0';
        const anim = card.animate(
          [
            { opacity: 0, transform: 'translateY(20px) scale(0.95)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          {
            duration: DURATION_FAST,
            delay: i * STACK_EXPAND_STAGGER,
            easing: SPRING,
            fill: 'forwards',
          },
        );
        this._activeAnims.push(anim);
        anim.finished
          .then(() => {
            anim.commitStyles();
            anim.cancel();
            card.style.opacity = '';
          })
          .catch(() => {
            /* cancelled */
          });
      }
    }

    // Overflow badge
    if (overflow > 0) {
      const badge = document.createElement('div');
      badge.className = 'notification-overflow';
      badge.textContent = this._t('lock_screen.more_notifications', {
        n: overflow,
      });
      stack.appendChild(badge);
    }
  }

  collapseStack(stack) {
    // Cancel any in-flight expand animations
    this.cancelActiveAnims();

    this._expanded = false;
    this._shadowRoot.host.classList.remove('stack-expanded');
    this._hideScrim();

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (reducedMotion) {
      this._rebuildCollapsedStack(stack);
      return;
    }

    const EXIT = EXIT_EASING;
    const wrappers = [...stack.querySelectorAll('.notification-card-wrapper')];
    const anims = wrappers
      .reverse()
      .map((w, i) => {
        const card = w.querySelector('.notification-card');
        if (!card) return null;
        const anim = card.animate(
          [
            { opacity: 1, transform: 'translateY(0) scale(1)' },
            { opacity: 0, transform: 'translateY(-10px) scale(0.95)' },
          ],
          {
            duration: DURATION_QUICK,
            delay: i * STAGGER_TIGHT,
            easing: EXIT,
            fill: 'forwards',
          },
        );
        this._activeAnims = this._activeAnims || [];
        this._activeAnims.push(anim);
        return anim;
      })
      .filter(Boolean);

    if (anims.length === 0) {
      this._rebuildCollapsedStack(stack);
      return;
    }

    Promise.all(anims.map((a) => a.finished))
      .then(() => {
        for (const a of anims) {
          a.commitStyles();
          a.cancel();
        }
        this._activeAnims = [];
        this._rebuildCollapsedStack(stack);
      })
      .catch(() => {
        /* cancelled — expand took over */
      });
  }

  _rebuildCollapsedStack(stack) {
    stack.classList.remove('expanded');
    stack.innerHTML = '';

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'notification-cards';
    stack.appendChild(cardsContainer);

    this._updateStackDepthClass(cardsContainer);

    const visible = this._notifications.slice(0, this._maxVisible);
    const overflow = this._notifications.length - this._maxVisible;

    for (let i = 0; i < visible.length; i++) {
      const wrapper = this._createCardElement(visible[i], i);
      wrapper.classList.remove('entering');
      cardsContainer.appendChild(wrapper);
    }

    if (overflow > 0) {
      const badge = document.createElement('div');
      badge.className = 'notification-overflow';
      badge.textContent = this._t('lock_screen.more_notifications', {
        n: overflow,
      });
      stack.appendChild(badge);
    }
  }

  /** Cancel any in-flight expand/collapse WAAPI animations */
  cancelActiveAnims() {
    if (this._activeAnims) {
      for (const a of this._activeAnims) a.cancel();
      this._activeAnims = [];
    }
  }

  /** Show backdrop blur scrim (expanded state, only for stacked notifications) */
  _showScrim() {
    if (this._notifications.length < 2) return;
    const scrim = this._shadowRoot.querySelector('.expanded-scrim');
    if (scrim) scrim.classList.add('visible');
  }

  /** Hide backdrop blur scrim (collapsed state) */
  _hideScrim() {
    const scrim = this._shadowRoot.querySelector('.expanded-scrim');
    if (scrim) scrim.classList.remove('visible');
  }

  /** Returns HTML string for initial render of notifications */
  renderHTML() {
    if (this._notifications.length === 0) return '';

    const visible = this._notifications.slice(0, this._maxVisible);
    const overflow = this._notifications.length - this._maxVisible;

    // Render visible cards — wrapped in .notification-card-wrapper to match _createCardElement
    const cards = visible
      .map((notif, idx) => {
        const stackIndex = idx; // 0 = front, 1 = behind
        return `
          <div class="notification-card-wrapper">
            <button type="button" class="notification-card" data-stacked="${stackIndex}"
                 aria-label="Notification from ${this._escapeHtml(notif.title)}">
              ${this._renderAvatar({ title: notif.title, avatarColor: notif.avatarColor, avatarLetter: notif.avatarLetter }, { cssClass: 'notification-avatar' })}
              <div class="notification-content">
                <div class="notification-header">
                  <span class="notification-title">${this._escapeHtml(notif.title)}</span>
                  <span class="notification-time">${this._formatNotificationTime(notif.timestamp)}</span>
                </div>
                <div class="notification-body">${this._escapeHtml(notif.preview)}</div>
              </div>
              <div class="notification-expand">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </button>
          </div>
        `;
      })
      .join('');

    const overflowBadge =
      overflow > 0
        ? `<div class="notification-overflow">+${overflow} more</div>`
        : '';

    const count = this._notifications.length;
    const stackClass = count >= 3 ? 'stack-3' : count === 2 ? 'stack-2' : '';

    return `
      <div class="notification-stack">
        <div class="notification-cards ${stackClass}">
          ${cards}
        </div>
        ${overflowBadge}
      </div>
    `;
  }

  /** Returns notification CSS string */
  static get styles() {
    return `
        /* Notification entrance — card slides up from below and settles */
        .notification-card-wrapper.entering .notification-card {
          animation: notification-enter-card ${CARD_ENTRANCE_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1.0) both;
        }

        @keyframes notification-enter-card {
          from { transform: translateY(40px) scale(0.96); }
          to   { transform: translateY(0) scale(1); }
        }

        /* Notification card */
        .notification-card {
          appearance: none;
          border: none;
          font: inherit;
          text-align: left;
          width: 100%;
          background: rgba(255, 255, 255, 0.95); /* lint-ignore: light card */
          border-radius: 20px;
          padding: 14px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); /* lint-ignore: shadow */
        }

        @media (hover: hover) {
          .notification-card:hover {
            transform: scale(1.01);
          }
        }

        .notification-card:active {
          transform: scale(0.99);
        }

        .notification-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 300;
          font-size: 16px;
          flex-shrink: 0;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 2px;
        }

        .notification-title {
          font-weight: 600;
          font-size: 14px;
          color: #1a1a1a; /* lint-ignore: light card text */
        }

        .notification-time {
          font-size: 12px;
          color: #666; /* lint-ignore: light card text */
        }

        .notification-body {
          font-size: 13px;
          color: #333; /* lint-ignore: light card text */
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .notification-expand {
          align-self: center;
          color: #999; /* lint-ignore: light card text */
          padding: 4px;
        }

        /* Notification stack container */
        .notification-stack {
          margin-top: auto;
          z-index: 3; /* Above scrim */
        }

        /* Cards sub-container — positioning context for absolute behind cards */
        .notification-cards {
          position: relative;
        }

        /* Smooth box-shadow transition when stack depth changes */
        .notification-card[data-stacked="0"] {
          transition: box-shadow ${STACK_SHADOW_TRANSITION_MS}ms cubic-bezier(0.05, 0.7, 0.1, 1.0);
        }

        /*
         * Stacked card positioning — iOS-style box-shadow technique.
         * Behind-card edges are faked via layered box-shadows on the
         * front card. Actual behind cards are hidden (display:none).
         * This avoids all clip-path / absolute-positioning issues.
         */
        .notification-card[data-stacked="0"] {
          position: relative;
        }

        /* 2-card stack: one edge peeking */
        .notification-cards.stack-2 .notification-card[data-stacked="0"] {
          box-shadow:
            0 2px 8px rgba(0, 0, 0, 0.12),                       /* lint-ignore: card shadow */
            0 9px 0 -3px rgba(240, 240, 240, 1),                  /* lint-ignore: 2nd card edge */
            0 10px 2px -2px rgba(0, 0, 0, 0.08);                  /* lint-ignore: 2nd card shadow */
        }

        /* 3+ card stack: two edges peeking */
        .notification-cards.stack-3 .notification-card[data-stacked="0"] {
          box-shadow:
            0 2px 8px rgba(0, 0, 0, 0.12),                       /* lint-ignore: card shadow */
            0 9px 0 -3px rgba(240, 240, 240, 1),                  /* lint-ignore: 2nd card edge */
            0 10px 2px -2px rgba(0, 0, 0, 0.08),                  /* lint-ignore: 2nd card shadow */
            0 16px 0 -5px rgba(225, 225, 225, 1),                 /* lint-ignore: 3rd card edge */
            0 17px 2px -4px rgba(0, 0, 0, 0.06);                  /* lint-ignore: 3rd card shadow */
        }

        /* Hide actual behind cards — their edges are faked by box-shadow */
        .notification-card[data-stacked="1"],
        .notification-card[data-stacked="2"] {
          display: none;
        }

        /* Show stacked box-shadow immediately during entrance (skip 350ms transition) */
        .notification-card-wrapper.entering .notification-card[data-stacked="0"] {
          transition: none;
        }

        /* Overflow badge */
        .notification-overflow {
          margin-top: 24px;
          text-align: center;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6); /* lint-ignore: lock screen theme */
          letter-spacing: 0.3px;
        }

        /* Expanded notification stack (Feature 3) */
        .notification-stack.expanded {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 60vh;
          overflow-y: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .notification-stack.expanded::-webkit-scrollbar {
          display: none;
        }

        .notification-stack.expanded .notification-card {
          display: flex; /* Override display:none on behind cards */
          position: relative;
          transform: none;
          opacity: 1;
          pointer-events: auto;
          z-index: auto;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); /* lint-ignore: card shadow */
        }

        /* Blur scrim shown when notification stack is expanded */
        .expanded-scrim {
          position: absolute;
          inset: 0;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          background: rgba(0, 0, 0, 0.15); /* lint-ignore: scrim overlay */
          opacity: 0;
          pointer-events: none;
          transition: opacity ${SCRIM_TRANSITION_MS}ms ease;
          z-index: 2;
        }
        .expanded-scrim.visible {
          opacity: 1;
          pointer-events: auto;
        }

        @media (prefers-reduced-motion: reduce) {
          .notification-card,
          .notification-card[data-stacked] {
            transition: none;
          }
          .notification-card-wrapper.entering .notification-card {
            animation: none;
          }
          .expanded-scrim {
            transition: none;
          }
        }
        /* Firefox: backdrop-filter causes blurry text with border-radius */
        @-moz-document url-prefix() {
          .expanded-scrim {
            backdrop-filter: none;
          }
        }
    `;
  }
}
