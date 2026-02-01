/**
 * lock-screen.js - Android-style lock screen entry point
 *
 * Features:
 * - Dark teal background with floating bubble particles (canvas)
 * - Status bar with signal and battery
 * - Large stacked time display (hours on top, minutes below)
 * - Weather widget
 * - Notification cards (view-only, listens to drawer-notification-added)
 * - Fingerprint icon to unlock (tap or swipe up)
 *
 * Subscribes to TimeContext for synchronized time display.
 * Notification state is owned by notification-drawer (SSOT).
 */

import { eventBus } from '../../../foundation/services/event-bus.js';
import { EVENTS } from '../events/events.js';
import {
  getLocale,
  getStartState,
  t,
} from '../services/conversation-context.js';
import { renderAvatar } from '../utils/avatar.js';
import { escapeHtml } from '../utils/text.js';

/**
 * LockScreen - Phone lock screen overlay
 *
 * @element lock-screen
 * @fires {CustomEvent} lock-screen-unlocked - When user taps fingerprint to unlock
 */
const WEATHER_ICONS = {
  sunny: '☀️',
  cloudy: '☁️',
  partly_cloudy: '⛅',
  rainy: '🌧️',
  stormy: '⛈️',
  snowy: '❄️',
  foggy: '🌫️',
};

export class LockScreen extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // State
    this._time = '9:00 AM';
    this._isoDate = null;
    this._dateFormat = 'weekday_short';
    this._weather = 'sunny';
    this._temperature = '';
    this._date = '';
    this._notifications = []; // Array of { title, preview, chatId, avatarLetter, avatarColor }
    this._maxVisible = 3;
    this._maxExpandedVisible = 5;
    this._expanded = false;
    this._battery = 100;
    this._signal = 4;
    this._internet = 'mobile4';
    this._unsubscribers = [];

    // Touch tracking for swipe
    this._touchStartY = null;
    this._swipeThreshold = 50;

    // Wake animation gate — notifications queue behind this
    this._wakeReady = Promise.resolve();

    // Active expand/collapse animations (for cancellation on rapid toggle)
    this._activeAnims = [];

    // Tracks whether initial wake notification flush has completed
    this._wakeFlushed = false;
    this._pendingNotifs = [];

    // Animation queue — serializes concurrent notification arrivals
    this._animationLock = Promise.resolve();

    // Particle animation
    this._canvas = null;
    this._ctx = null;
    this._particles = [];
    this._animationId = null;
  }

  connectedCallback() {
    this.render();
    this._initCanvas();
    this._initParticles();
    this._startAnimation();
    this._subscribeToEvents();
    this._setupTouchHandlers();
    this._playWakeAnimation();

    // Config is guaranteed ready via deferred component registration (BUG-002 fix)
    this._initFromConfig();
    if (this._isoDate) this._updateDateWeather();
    this._captureFocus();
  }

  disconnectedCallback() {
    for (const unsub of this._unsubscribers) {
      unsub();
    }
    this._unsubscribers = [];

    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  /**
   * Add a notification to display (supports multiple stacked notifications)
   * @param {object} options
   * @param {string} options.title - Notification title (e.g. "Gov News Wire")
   * @param {string} options.preview - Notification preview text
   * @param {string} options.chatId - Chat ID for this notification
   * @param {string} [options.avatarLetter='?'] - Single letter for avatar
   * @param {string} [options.avatarColor='#6b8afd'] - Background color for avatar (lint-ignore: JSDoc default)
   * @param {number} [options.timestamp] - When notification arrived (Date.now())
   */
  addNotification({
    title,
    preview,
    chatId,
    avatarLetter = '?',
    avatarColor = '#6b8afd', // lint-ignore: fallback avatar color
    timestamp = Date.now(),
  }) {
    const notif = {
      title,
      preview,
      chatId,
      avatarLetter,
      avatarColor,
      timestamp,
    };
    this._notifications.push(notif);

    // After initial wake flush, show notifications immediately with
    // per-card entrance animation
    if (this._wakeFlushed) {
      this._wakeReady.then(() => this._showNotification(notif));
      return;
    }

    // During wake: queue notifications and flush them together so
    // multiple arrivals render as one smooth stack entrance.
    if (!this._pendingNotifs) this._pendingNotifs = [];
    this._pendingNotifs.push(notif);

    // Only schedule one flush per gate
    if (this._pendingNotifs.length === 1) {
      this._wakeReady.then(() => this._flushPendingNotifications());
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
    const stack = this.shadowRoot.querySelector('.notification-stack');
    if (!stack || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;

    stack.style.opacity = '0';
    const DECELERATE = 'cubic-bezier(0.05, 0.7, 0.1, 1.0)';
    const anim = stack.animate(
      [
        { opacity: 0, transform: 'scale(0.92)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 900, easing: DECELERATE, fill: 'forwards' },
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

  /** Queue and render a notification card with choreographed entrance */
  _showNotification(notif, skipAnimation = false) {
    this._animationLock = this._animationLock.then(() =>
      this._showNotificationInner(notif, skipAnimation),
    );
    return this._animationLock;
  }

  async _showNotificationInner(notif, skipAnimation) {
    const stack = this.shadowRoot.querySelector('.notification-stack');
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
      setTimeout(resolve, 850); // Safety timeout (BUG-003 pattern)
    });

    wrapper.classList.remove('entering');

    // 5. Stagger delay before next queued notification
    await new Promise((r) => setTimeout(r, 150));
  }

  /** Create the notification stack container for the first notification */
  _renderNotificationStack(notif, skipAnimation = false) {
    const content = this.shadowRoot.querySelector('.content');
    const bottomSection = this.shadowRoot.querySelector('.bottom-section');
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
    this._wireStackClickHandler(stack);

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
           aria-label="Notification from ${escapeHtml(notif.title)}">
        ${renderAvatar({ title: notif.title, avatarColor: notif.avatarColor, avatarLetter: notif.avatarLetter }, { cssClass: 'notification-avatar' })}
        <div class="notification-content">
          <div class="notification-header">
            <span class="notification-title">${escapeHtml(notif.title)}</span>
            <span class="notification-time">${this._formatNotificationTime(notif.timestamp)}</span>
          </div>
          <div class="notification-body">${escapeHtml(notif.preview)}</div>
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
   * Show lock screen with given notifications, restarting animation
   * @param {Array} notifications - Array of notification objects
   */
  show(notifications = []) {
    this._notifications = notifications;
    this._cancelActiveAnims();
    this._expanded = false;
    this._wakeFlushed = true; // Stack already rendered, no wake gate
    this._pendingNotifs = [];
    this._animationLock = Promise.resolve(); // Reset stale queue
    this.hidden = false;
    this.style.opacity = ''; // Clear opacity left by animateOut()
    this.render();
    this._initCanvas();
    this._initParticles();
    this._startAnimation();
    this._setupTouchHandlers();
    this._captureFocus();
  }

  /**
   * Format notification timestamp for display
   * Shows "now" if within last minute, otherwise shows time
   */
  _formatNotificationTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    // Within last minute = "now"
    if (diff < 60000) {
      return 'now';
    }

    // Otherwise show time like "5:06 PM"
    return new Date(timestamp).toLocaleTimeString(getLocale(), {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  _subscribeToEvents() {
    this._unsubscribers.push(
      eventBus.on(EVENTS.TIME_UPDATED, (e) => {
        this._time = e.detail.time;
        this._updateTimeDisplay();
      }),
    );

    // Listen to drawer events (drawer is SSOT for notification state)
    const onDrawerNotification = (e) => {
      // Only show if lock screen is visible
      if (this.hidden) return;
      const { chatId, title, preview, avatarLetter, avatarColor, timestamp } =
        e.detail;
      this.addNotification({
        chatId,
        title,
        preview,
        avatarLetter,
        avatarColor,
        timestamp,
      });
    };
    document.addEventListener(
      'drawer-notification-added',
      onDrawerNotification,
    );
    this._unsubscribers.push(() => {
      document.removeEventListener(
        'drawer-notification-added',
        onDrawerNotification,
      );
    });

    this._unsubscribers.push(
      eventBus.on(EVENTS.DAY_ADVANCED, (e) => {
        this._time = e.detail.time;
        const d = new Date(`${this._isoDate}T00:00:00`);
        d.setDate(d.getDate() + 1);
        this._isoDate = d.toISOString().slice(0, 10);
        this._date = this._formatDate(this._isoDate, this._dateFormat);
        this._updateTimeDisplay();
      }),
    );

    this._unsubscribers.push(
      eventBus.on(EVENTS.BATTERY_CHANGED, (e) => {
        this._battery = e.detail.battery;
        this._updateStatusBar();
      }),
    );
  }

  _formatDate(isoDate, format) {
    const date = new Date(`${isoDate}T00:00:00`);
    const locale = getLocale();
    switch (format) {
      case 'weekday_long':
        return date.toLocaleDateString(locale, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
      case 'numeric':
        return date.toLocaleDateString(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
      case 'iso':
        return isoDate;
      default:
        return date.toLocaleDateString(locale, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
    }
  }

  _parseTime(timeStr) {
    // Parse "9:00 AM" format into hours and minutes
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return { hours: '09', minutes: '00' };

    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3]?.toUpperCase();

    // Convert to 24-hour for internal use
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    // Keep 12-hour format for display
    let displayHours = hours % 12;
    if (displayHours === 0) displayHours = 12;

    // Pad with leading zero
    return {
      hours: String(displayHours).padStart(2, '0'),
      minutes,
    };
  }

  _updateTimeDisplay() {
    const timeContainer = this.shadowRoot.querySelector('.time-stacked');
    if (!timeContainer) return;

    const { hours, minutes } = this._parseTime(this._time);
    const hoursEl = timeContainer.querySelector('.hours');
    const minutesEl = timeContainer.querySelector('.minutes');

    if (hoursEl) hoursEl.textContent = hours;
    if (minutesEl) minutesEl.textContent = minutes;
  }

  _updateStatusBar() {
    // Battery and internet are re-rendered via full status bar update
    const statusBar = this.shadowRoot.querySelector('.status-bar');
    if (statusBar) {
      statusBar.innerHTML = this._renderStatusBarContent();
    }
  }

  _initCanvas() {
    this._canvas = this.shadowRoot.querySelector('.particle-canvas');
    if (!this._canvas) return;

    this._ctx = this._canvas.getContext('2d');
    this._resizeCanvas();

    // Handle resize
    this._resizeObserver = new ResizeObserver(() => this._resizeCanvas());
    this._resizeObserver.observe(this._canvas.parentElement);
  }

  _resizeCanvas() {
    if (!this._canvas) return;
    const rect = this._canvas.parentElement.getBoundingClientRect();
    this._canvas.width = rect.width;
    this._canvas.height = rect.height;
  }

  _initParticles() {
    this._particles = [];
    const count = 20;

    for (let i = 0; i < count; i++) {
      this._particles.push({
        x: Math.random() * 400,
        y: Math.random() * 800,
        radius: Math.random() * 20 + 10,
        alpha: Math.random() * 0.15 + 0.05,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3 - 0.2,
      });
    }
  }

  _startAnimation() {
    const animate = () => {
      this._animationId = requestAnimationFrame(animate);
      this._drawParticles();
    };
    animate();
  }

  _drawParticles() {
    if (!this._ctx || !this._canvas) return;

    const { width, height } = this._canvas;
    this._ctx.clearRect(0, 0, width, height);

    for (const p of this._particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -p.radius) p.x = width + p.radius;
      if (p.x > width + p.radius) p.x = -p.radius;
      if (p.y < -p.radius) p.y = height + p.radius;
      if (p.y > height + p.radius) p.y = -p.radius;

      this._ctx.beginPath();
      this._ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this._ctx.fillStyle = `rgba(100, 180, 220, ${p.alpha})`; // lint-ignore: lock screen particles
      this._ctx.fill();
    }
  }

  _setupTouchHandlers() {
    const container = this.shadowRoot.querySelector('.lock-screen');
    if (!container) return;

    // Touch events for swipe up
    container.addEventListener(
      'touchstart',
      (e) => {
        this._touchStartY = e.touches[0].clientY;
      },
      { passive: true },
    );

    container.addEventListener(
      'touchend',
      (e) => {
        if (this._touchStartY === null) return;
        const deltaY = this._touchStartY - e.changedTouches[0].clientY;
        if (deltaY > this._swipeThreshold) {
          this._unlock();
        }
        this._touchStartY = null;
      },
      { passive: true },
    );

    // Click on fingerprint icon to unlock
    const fingerprintBtn = this.shadowRoot.querySelector('.fingerprint-btn');
    if (fingerprintBtn) {
      fingerprintBtn.addEventListener('click', () => this._unlock());
    }

    // Attach delegated click handler if stack already exists in initial render
    const stack = this.shadowRoot.querySelector('.notification-stack');
    if (stack) this._wireStackClickHandler(stack);

    // Click outside expanded stack (or on scrim) to collapse
    const lockScreenEl = this.shadowRoot.querySelector('.lock-screen');
    if (lockScreenEl) {
      lockScreenEl.addEventListener('click', (e) => {
        if (
          this._expanded &&
          !e.target.closest('.notification-stack') &&
          !e.target.closest('.fingerprint-btn')
        ) {
          this._collapseStack(
            this.shadowRoot.querySelector('.notification-stack'),
          );
        }
      });
    }
  }

  /**
   * Attach delegated click handler to notification stack.
   * - Collapsed: card click → expand
   * - Expanded: card click → bounce fingerprint
   */
  _wireStackClickHandler(stack) {
    stack.addEventListener('click', (e) => {
      if (!e.target.closest('.notification-card')) return;
      e.stopPropagation();
      if (this._expanded) {
        this._bounceFingerprint();
      } else if (this._notifications.length > 1) {
        this._expandStack(stack);
      } else {
        this._bounceFingerprint();
      }
    });
  }

  _bounceFingerprint() {
    const fingerprintBtn = this.shadowRoot.querySelector('.fingerprint-btn');
    if (!fingerprintBtn) return;

    // Add bounce animation class
    fingerprintBtn.classList.add('bounce');

    // Remove after animation completes
    setTimeout(() => {
      fingerprintBtn.classList.remove('bounce');
    }, 600);
  }

  /** Feature 1: Wake-up stagger animation on page load */
  _playWakeAnimation() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Reduced motion: single short fade
      const root = this.shadowRoot.querySelector('.lock-screen');
      if (root) {
        root.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 200,
          easing: 'ease',
        });
      }
      return;
    }

    const DECELERATE = 'cubic-bezier(0.05, 0.7, 0.1, 1.0)';
    // Hide child content before stagger — keep .lock-screen background visible
    const childSels = [
      '.status-bar',
      '.date-weather',
      '.time-stacked',
      '.bottom-section',
    ];
    for (const sel of childSels) {
      const el = this.shadowRoot.querySelector(sel);
      if (el) el.style.opacity = '0';
    }

    const elements = [
      {
        sel: '.lock-screen',
        delay: 0,
        dur: 900,
        kf: [
          { opacity: 0.7, transform: 'scale(1.04)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
      },
      {
        sel: '.status-bar',
        delay: 200,
        dur: 500,
        kf: [{ opacity: 0 }, { opacity: 1 }],
      },
      {
        sel: '.date-weather',
        delay: 350,
        dur: 600,
        kf: [
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
      },
      {
        sel: '.time-stacked',
        delay: 500,
        dur: 800,
        kf: [
          { opacity: 0, transform: 'scale(0.92)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
      },
      {
        sel: '.bottom-section',
        delay: 750,
        dur: 550,
        kf: [{ opacity: 0 }, { opacity: 1 }],
      },
    ];

    const anims = [];
    for (const { sel, delay, dur, kf } of elements) {
      const el = this.shadowRoot.querySelector(sel);
      if (el) {
        const anim = el.animate(kf, {
          duration: dur,
          delay,
          easing: DECELERATE,
          fill: 'forwards',
        });
        // Commit final values as inline styles before cancelling so
        // identity transforms (scale(1), translateY(0)) persist and
        // the compositor layer isn't torn down (prevents snap-back).
        anims.push(
          anim.finished.then(() => {
            anim.commitStyles();
            anim.cancel();
            el.style.opacity = '';
          }),
        );
      }
    }
    // Notifications gate: appear after fingerprint is mostly faded in.
    // Bottom-section starts at 750ms + ~450ms to reach full opacity = ~1200ms.
    this._wakeReady = new Promise((r) => setTimeout(r, 1200));
  }

  /**
   * Feature 2: Animate lock screen exit, returns Promise that resolves when done.
   * Caller should set lockScreen.hidden = true after awaiting.
   * @returns {Promise<void>}
   */
  /**
   * Stop canvas particles (called before unlock transition).
   */
  stopAnimation() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  _expandStack(stack) {
    // Cancel any in-flight collapse animations
    this._cancelActiveAnims();

    this._expanded = true;
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
          { duration: 300, delay: i * 40, easing: SPRING, fill: 'forwards' },
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
      badge.textContent = t('lock_screen.more_notifications', { n: overflow });
      stack.appendChild(badge);
    }
  }

  _collapseStack(stack) {
    // Cancel any in-flight expand animations
    this._cancelActiveAnims();

    this._expanded = false;
    this._hideScrim();

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (reducedMotion) {
      this._rebuildCollapsedStack(stack);
      return;
    }

    const EXIT = 'cubic-bezier(0.3, 0, 0.8, 0.15)';
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
          { duration: 200, delay: i * 30, easing: EXIT, fill: 'forwards' },
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
      badge.textContent = t('lock_screen.more_notifications', { n: overflow });
      stack.appendChild(badge);
    }
  }

  /** Cancel any in-flight expand/collapse WAAPI animations */
  _cancelActiveAnims() {
    if (this._activeAnims) {
      for (const a of this._activeAnims) a.cancel();
      this._activeAnims = [];
    }
  }

  /** Show backdrop blur scrim (expanded state, only for stacked notifications) */
  _showScrim() {
    if (this._notifications.length < 2) return;
    const scrim = this.shadowRoot.querySelector('.expanded-scrim');
    if (scrim) scrim.classList.add('visible');
  }

  /** Hide backdrop blur scrim (collapsed state) */
  _hideScrim() {
    const scrim = this.shadowRoot.querySelector('.expanded-scrim');
    if (scrim) scrim.classList.remove('visible');
  }

  _captureFocus() {
    const container = this.shadowRoot.querySelector('.lock-screen');
    container?.focus({ preventScroll: true });
  }

  _unlock() {
    // Stop animation
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }

    // Dispatch unlock event (no longer passing chatId - notification doesn't open chat)
    this.dispatchEvent(
      new CustomEvent('lock-screen-unlocked', {
        bubbles: true,
        detail: {},
      }),
    );

    // Transition handler (main.js) hides via transitionViews
  }

  _getSignalIcon(level) {
    const icons = [
      'signal_cellular_0_bar',
      'signal_cellular_1_bar',
      'signal_cellular_2_bar',
      'signal_cellular_3_bar',
      'signal_cellular_4_bar',
    ];
    return icons[Math.max(0, Math.min(4, level))] || icons[0];
  }

  _getBatteryIcon(percent) {
    if (percent >= 95) return 'battery_full';
    if (percent >= 83) return 'battery_6_bar';
    if (percent >= 70) return 'battery_5_bar';
    if (percent >= 57) return 'battery_4_bar';
    if (percent >= 43) return 'battery_3_bar';
    if (percent >= 30) return 'battery_2_bar';
    if (percent >= 15) return 'battery_1_bar';
    return 'battery_0_bar';
  }

  _getWifiIcon(level) {
    if (level === 0) return 'wifi_off';
    if (level === 1) return 'wifi_2_bar';
    return 'wifi';
  }

  _renderInternetIcon(type) {
    if (!type || type === 'none') return '';
    if (type === 'airplane') {
      return `<span class="material-symbols-outlined status-icon" aria-hidden="true">airplanemode_active</span>`;
    }
    const wifiMatch = type.match(/^wifi(\d)$/);
    if (wifiMatch) {
      const icon = this._getWifiIcon(parseInt(wifiMatch[1], 10));
      return `<span class="material-symbols-outlined status-icon" aria-hidden="true">${icon}</span>`;
    }
    const mobileMatch = type.match(/^mobile(\d)$/);
    if (mobileMatch) {
      return this._renderMobileIcon(parseInt(mobileMatch[1], 10));
    }
    return '';
  }

  _renderMobileIcon(level) {
    const labels = ['', 'G', 'E', '3G', '4G', '5G'];
    const label = labels[level] || '';
    if (!label) {
      return `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><text x="7" y="11" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" opacity="0.3">G</text><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    }
    const w = label.length <= 1 ? 10 : label.length === 2 ? 16 : 20;
    return `<svg width="${w}" height="14" viewBox="0 0 ${w} 14" aria-hidden="true"><text x="${w / 2}" y="11.5" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${label}</text></svg>`;
  }

  _renderStatusBarContent() {
    const batteryPercent = Math.round(this._battery);
    const internetHtml =
      this._internet && this._internet !== 'none'
        ? `<span class="internet">${this._renderInternetIcon(this._internet)}</span>`
        : '';
    return `
      <span class="signal"><span class="material-symbols-outlined status-icon" aria-hidden="true">${this._getSignalIcon(this._signal)}</span></span>
      ${internetHtml}
      <span class="battery-wrap">
        <span class="material-symbols-outlined status-icon" aria-hidden="true">${this._getBatteryIcon(this._battery)}</span>
        <span class="battery-percent">${batteryPercent}</span>
      </span>
    `;
  }

  _renderNotifications() {
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
                 aria-label="Notification from ${escapeHtml(notif.title)}">
              ${renderAvatar({ title: notif.title, avatarColor: notif.avatarColor, avatarLetter: notif.avatarLetter }, { cssClass: 'notification-avatar' })}
              <div class="notification-content">
                <div class="notification-header">
                  <span class="notification-title">${escapeHtml(notif.title)}</span>
                  <span class="notification-time">${this._formatNotificationTime(notif.timestamp)}</span>
                </div>
                <div class="notification-body">${escapeHtml(notif.preview)}</div>
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

  _initFromConfig() {
    if (this._isoDate) return;
    const startState = getStartState();
    // getStartState() returns {} before main.js registers config
    if (!startState.date) return;
    this._isoDate = startState.date;
    this._dateFormat = startState.date_format || 'weekday_short';
    this._weather = startState.weather || 'sunny';
    this._temperature = startState.temperature || '';
    this._internet = startState.internet || this._internet;
    this._signal = startState.signal ?? this._signal;
    this._battery = startState.battery ?? this._battery;
    this._date = this._formatDate(this._isoDate, this._dateFormat);
  }

  /**
   * Seed lock screen with existing notifications (e.g. from drawer on refresh).
   * Called by the orchestrator (main.js) after game init.
   * @param {Array<Object>} notifications - Array of notification objects
   */
  seedNotifications(notifications) {
    if (this._notifications.length > 0 || notifications.length === 0) return;
    for (const notif of notifications) {
      this._notifications.push(notif);
      this._showNotification(notif);
    }
  }

  /**
   * Update weather and temperature from ink status tags at runtime.
   * @param {string} [weather] - Weather key (e.g. 'cloudy', 'sunny')
   * @param {string} [temperature] - Temperature string (e.g. '24°C')
   */
  updateWeather(weather, temperature) {
    if (weather !== undefined) this._weather = weather;
    if (temperature !== undefined) this._temperature = temperature;
    this._updateDateWeather();
  }

  /** Patch date-weather DOM once config becomes available after initial render */
  _updateDateWeather() {
    const dateEl = this.shadowRoot.querySelector('.date');
    if (dateEl) dateEl.textContent = this._date;
    const iconEl = this.shadowRoot.querySelector('.weather-icon');
    if (iconEl) iconEl.textContent = WEATHER_ICONS[this._weather] || '☀️';
    const tempEl = iconEl?.nextElementSibling;
    if (tempEl) tempEl.textContent = this._temperature;
  }

  render() {
    this._initFromConfig();
    const { hours, minutes } = this._parseTime(this._time);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: absolute;
          inset: 0;
          z-index: 1000;
          border-radius: calc(var(--ink-radius-phone, 25px) - 6px);
          overflow: hidden;
        }

        :host([hidden]) {
          display: none;
        }

        .lock-screen {
          position: relative;
          width: 100%;
          height: 100%;
          outline: none;
          background: linear-gradient(180deg, #0d3d4d 0%, #0a2832 50%, #061820 100%); /* lint-ignore: lock screen teal theme */
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: var(--ink-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
          color: #e8e8ed; /* lint-ignore: lock screen theme */
          user-select: none;
        }

        .particle-canvas {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-weight: normal;
          font-style: normal;
          font-size: 18px;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          white-space: nowrap;
          direction: ltr;
          -webkit-font-smoothing: antialiased;
          font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
        }

        .status-icon {
          font-size: 16px;
        }

        /* Status bar */
        .status-bar {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 6px;
          padding: 12px 16px 8px;
          font-size: 13px;
        }

        .status-bar .signal {
          display: flex;
          align-items: center;
          margin-right: 2px;
        }

        .status-bar .internet {
          display: flex;
          align-items: center;
        }

        .status-bar .battery-wrap {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .status-bar .battery-wrap .status-icon {
          font-size: 18px;
          transform: scaleX(1.15);
        }

        .status-bar .battery-percent {
          font-family: 'Inter', var(--ink-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
          font-size: 11px;
          font-weight: 600;
        }

        /* Main content - hidden scrollbar (smartphone-style) */
        .content {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 8px 24px 24px;
          overflow-y: auto;
          min-height: 0; /* Allow flex child to shrink below content size */
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .content::-webkit-scrollbar {
          display: none;
        }

        /* Date and weather row */
        .date-weather {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 4px;
        }

        .date {
          font-family: 'Inter', var(--ink-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
          font-size: 15px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85); /* lint-ignore: lock screen theme */
          letter-spacing: 0.2px;
        }

        .weather {
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgba(255, 255, 255, 0.85); /* lint-ignore: lock screen theme */
          font-family: 'Inter', var(--ink-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
          font-size: 14px;
          font-weight: 500;
        }

        .weather-icon {
          font-size: 16px;
        }

        /* Large stacked time */
        .time-stacked {
          display: flex;
          flex-direction: column;
          line-height: 0.85;
          margin-bottom: 24px;
        }

        .time-stacked .hours,
        .time-stacked .minutes {
          font-size: clamp(90px, 24vw, 140px);
          font-weight: 200;
          letter-spacing: -3px;
          color: rgba(255, 255, 255, 0.95); /* lint-ignore: lock screen theme */
        }

        /* Notification entrance — card slides up from below and settles */
        .notification-card-wrapper.entering .notification-card {
          animation: notification-enter-card 800ms cubic-bezier(0.25, 0.1, 0.25, 1.0) both;
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
          transition: box-shadow 350ms cubic-bezier(0.05, 0.7, 0.1, 1.0);
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
          transition: opacity 300ms ease;
          z-index: 2;
        }
        .expanded-scrim.visible {
          opacity: 1;
          pointer-events: auto;
        }

        /* Bottom section with fingerprint */
        .bottom-section {
          position: relative;
          z-index: 3; /* Above scrim so fingerprint stays clickable */
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 24px 32px;
          margin-top: auto; /* Push to bottom when space available */
        }

        .fingerprint-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.12); /* lint-ignore: lock screen */
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        @media (hover: hover) {
          .fingerprint-btn:hover {
            background: rgba(255, 255, 255, 0.2); /* lint-ignore: lock screen */
          }
        }

        .fingerprint-btn:active {
          transform: scale(0.95);
        }

        .fingerprint-btn svg {
          width: 34px;
          height: 34px;
          color: rgba(255, 255, 255, 0.9); /* lint-ignore: lock screen */
        }

        .fingerprint-btn.bounce {
          animation: bounce 0.6s ease;
        }

        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.15); }
          50% { transform: scale(0.9); }
          75% { transform: scale(1.05); }
        }

        .unlock-hint {
          margin-top: 12px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4); /* lint-ignore: lock screen */
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        @media (prefers-reduced-motion: reduce) {
          .notification-card,
          .fingerprint-btn {
            transition: none;
          }
          .notification-card[data-stacked] {
            transition: none;
          }
          .notification-card-wrapper.entering .notification-card {
            animation: none;
          }
          .fingerprint-btn.bounce {
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
      </style>

      <div class="lock-screen" tabindex="-1">
        <canvas class="particle-canvas"></canvas>

        <!-- Status bar -->
        <div class="status-bar">
          ${this._renderStatusBarContent()}
        </div>

        <div class="content">
          <!-- Date and weather -->
          <div class="date-weather">
            <span class="date">${escapeHtml(this._date)}</span>
            <span class="weather">
              <span class="weather-icon">${WEATHER_ICONS[this._weather] || '☀️'}</span>
              <span>${escapeHtml(this._temperature)}</span>
            </span>
          </div>

          <!-- Large stacked time -->
          <div class="time-stacked">
            <span class="hours">${hours}</span>
            <span class="minutes">${minutes}</span>
          </div>

          <div class="expanded-scrim"></div>

          ${this._renderNotifications()}

          <!-- Fingerprint unlock -->
          <div class="bottom-section">
          <button class="fingerprint-btn" aria-label="Unlock with fingerprint">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12.025 4.475q2.65 0 5 1.138T20.95 8.9q.175.225.113.4t-.213.3t-.35.113t-.35-.213q-1.375-1.95-3.537-2.987t-4.588-1.038t-4.55 1.038T3.95 9.5q-.15.225-.35.25t-.35-.1q-.175-.125-.213-.312t.113-.388q1.55-2.125 3.888-3.3t4.987-1.175m0 2.35q3.375 0 5.8 2.25t2.425 5.575q0 1.25-.887 2.088t-2.163.837t-2.187-.837t-.913-2.088q0-.825-.612-1.388t-1.463-.562t-1.463.563t-.612 1.387q0 2.425 1.438 4.05t3.712 2.275q.225.075.3.25t.025.375q-.05.175-.2.3t-.375.075q-2.6-.65-4.25-2.588T8.95 14.65q0-1.25.9-2.1t2.175-.85t2.175.85t.9 2.1q0 .825.625 1.388t1.475.562t1.45-.562t.6-1.388q0-2.9-2.125-4.875T12.05 7.8T6.975 9.775t-2.125 4.85q0 .6.113 1.5t.537 2.1q.075.225-.012.4t-.288.25t-.387-.012t-.263-.288q-.375-.975-.537-1.937T3.85 14.65q0-3.325 2.413-5.575t5.762-2.25m0-4.8q1.6 0 3.125.387t2.95 1.113q.225.125.263.3t-.038.35t-.25.275t-.425-.025q-1.325-.675-2.738-1.037t-2.887-.363q-1.45 0-2.85.338T6.5 4.425q-.2.125-.4.063t-.3-.263t-.05-.362t.25-.288q1.4-.75 2.925-1.15t3.1-.4m0 7.225q2.325 0 4 1.563T17.7 14.65q0 .225-.137.363t-.363.137q-.2 0-.35-.137t-.15-.363q0-1.875-1.388-3.137t-3.287-1.263t-3.262 1.263T7.4 14.65q0 2.025.7 3.438t2.05 2.837q.15.15.15.35t-.15.35t-.35.15t-.35-.15q-1.475-1.55-2.262-3.162T6.4 14.65q0-2.275 1.65-3.838t3.975-1.562M12 14.15q.225 0 .363.15t.137.35q0 1.875 1.35 3.075t3.15 1.2q.15 0 .425-.025t.575-.075q.225-.05.388.063t.212.337q.05.2-.075.35t-.325.2q-.45.125-.787.138t-.413.012q-2.225 0-3.863-1.5T11.5 14.65q0-.2.138-.35t.362-.15"/>
            </svg>
          </button>
          <span class="unlock-hint">Tap to unlock</span>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('lock-screen', LockScreen);
