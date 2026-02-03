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
import {
  getBatteryIcon,
  getSignalIcon,
  renderInternetIcon,
} from '../utils/status-icons.js';
import { escapeHtml } from '../utils/text.js';
import {
  LockScreenNotifications,
  SCRIM_TRANSITION_MS,
} from './lock-screen-notifications.js';
import { ParticleSystem } from './lock-screen-particles.js';
import { LockScreenWake } from './lock-screen-wake.js';

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

const FINGERPRINT_BOUNCE_MS = 600;

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
    this._battery = 100;
    this._signal = 4;
    this._internet = 'mobile4';
    this._unsubscribers = [];

    // Touch tracking for swipe
    this._touchStartY = null;
    this._swipeThreshold = 50;

    // Particle animation (delegated to ParticleSystem)
    this._particleSystem = null;
  }

  connectedCallback() {
    this.render();

    // Initialize extracted modules
    this._wake = new LockScreenWake(this.shadowRoot);
    this._notifs = new LockScreenNotifications(this.shadowRoot, {
      escapeHtml,
      renderAvatar,
      getLocale,
      t,
    });

    const canvas = this.shadowRoot.querySelector('.particle-canvas');
    if (canvas) {
      this._particleSystem = new ParticleSystem(canvas);
      this._particleSystem.start();
    }
    this._subscribeToEvents();
    this._setupTouchHandlers();
    this._wake.play();

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

    this._particleSystem?.destroy();
    this._particleSystem = null;
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
    this._notifs.add(
      { title, preview, chatId, avatarLetter, avatarColor, timestamp },
      this._wake.ready,
    );
  }

  /**
   * Show lock screen with given notifications, restarting animation
   * @param {Array} notifications - Array of notification objects
   */
  show(notifications = []) {
    this.hidden = false; // lint-ignore: direct visibility (not a transition target)
    this.style.opacity = ''; // Clear opacity left by animateOut()

    // Re-initialize modules before render so renderHTML() includes notifications
    this._wake = new LockScreenWake(this.shadowRoot);
    this._notifs = new LockScreenNotifications(this.shadowRoot, {
      escapeHtml,
      renderAvatar,
      getLocale,
      t,
    });
    this._notifs.reset();
    this._notifs.setNotifications(notifications);

    this.render();

    const canvas = this.shadowRoot.querySelector('.particle-canvas');
    if (canvas) {
      this._particleSystem = new ParticleSystem(canvas);
      this._particleSystem.start();
    }
    this._setupTouchHandlers();
    this._captureFocus();
  }

  /**
   * Seed lock screen with existing notifications (e.g. from drawer on refresh).
   * Called by the orchestrator (main.js) after game init.
   * @param {Array<Object>} notifications - Array of notification objects
   */
  seedNotifications(notifications) {
    this._notifs.seed(notifications);
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

  /**
   * Stop canvas particles (called before unlock transition).
   */
  stopAnimation() {
    this._particleSystem?.stop();
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
    if (stack) {
      this._notifs.wireClickHandler(stack, () => this._bounceFingerprint());
    }

    // Click outside expanded stack (or on scrim) to collapse
    const lockScreenEl = this.shadowRoot.querySelector('.lock-screen');
    if (lockScreenEl) {
      lockScreenEl.addEventListener('click', (e) => {
        if (
          this._notifs.expanded &&
          !e.target.closest('.notification-stack') &&
          !e.target.closest('.fingerprint-btn')
        ) {
          this._notifs.collapseStack(
            this.shadowRoot.querySelector('.notification-stack'),
          );
        }
      });
    }
  }

  _bounceFingerprint() {
    const fingerprintBtn = this.shadowRoot.querySelector('.fingerprint-btn');
    if (!fingerprintBtn) return;

    // Add bounce animation class
    fingerprintBtn.classList.add('bounce');

    // Remove after animation completes
    setTimeout(() => {
      fingerprintBtn.classList.remove('bounce');
    }, FINGERPRINT_BOUNCE_MS);
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

  _renderStatusBarContent() {
    const batteryPercent = Math.round(this._battery);
    const internetHtml =
      this._internet && this._internet !== 'none'
        ? `<span class="internet">${renderInternetIcon(this._internet, { iconClass: 'status-icon' })}</span>`
        : '';
    return `
      <span class="signal"><span class="material-symbols-outlined status-icon" aria-hidden="true">${getSignalIcon(this._signal)}</span></span>
      ${internetHtml}
      <span class="battery-wrap">
        <span class="material-symbols-outlined status-icon" aria-hidden="true">${getBatteryIcon(this._battery)}</span>
        <span class="battery-percent">${batteryPercent}</span>
      </span>
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
    this._time = startState.current_time || this._time;
    this._internet = startState.internet || this._internet;
    this._signal = startState.signal ?? this._signal;
    this._battery = startState.battery ?? this._battery;
    this._date = this._formatDate(this._isoDate, this._dateFormat);
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

        /* Mirror of .expanded-scrim that covers the status bar area */
        .status-bar::after {
          content: '';
          position: absolute;
          inset: 0;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          background: rgba(0, 0, 0, 0.15); /* lint-ignore: scrim overlay */
          opacity: 0;
          pointer-events: none;
          transition: opacity ${SCRIM_TRANSITION_MS}ms ease;
        }
        :host(.stack-expanded) .status-bar::after {
          opacity: 1;
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

        ${LockScreenNotifications.styles}

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
          .fingerprint-btn {
            transition: none;
          }
          .fingerprint-btn.bounce {
            animation: none;
          }
          .status-bar::after {
            transition: none;
          }
        }
        /* Firefox: backdrop-filter causes blurry text with border-radius */
        @-moz-document url-prefix() {
          .status-bar::after {
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

          ${this._notifs ? this._notifs.renderHTML() : ''}

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
