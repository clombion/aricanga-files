/**
 * phone-status-bar.js - iOS-style status bar with time, battery, signal
 *
 * Displays phone status indicators and serves as button to open notification shade.
 * Receives time updates from TimeContext via EventBus.
 */

// Foundation services
import { eventBus } from '../../../foundation/services/event-bus.js';
// Conversation system events
import { EVENTS } from '../events/events.js';
import { createPhoneStatus } from '../types.js';
import {
  getBatteryIcon,
  getSignalIcon,
  renderInternetIcon,
} from '../utils/status-icons.js';
import { escapeHtml } from '../utils/text.js';

/**
 * PhoneStatusBar - Phone status indicator bar
 *
 * @element phone-status-bar
 * @fires {CustomEvent} drawer-open-requested - When user clicks to open notification drawer
 */
export class PhoneStatusBar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._state = createPhoneStatus();
    this._drawerCount = 0;
    this._unsubscribers = [];
  }

  connectedCallback() {
    this.render();
    this.subscribeToEvents();
  }

  disconnectedCallback() {
    for (const unsub of this._unsubscribers) {
      unsub();
    }
    this._unsubscribers = [];
    if (this._onDrawerCountChanged) {
      document.removeEventListener(
        'drawer-count-changed',
        this._onDrawerCountChanged,
      );
    }
  }

  subscribeToEvents() {
    // Subscribe to time updates from TimeContext
    this._unsubscribers.push(
      eventBus.on(EVENTS.TIME_UPDATED, (e) => {
        this.update({ time: e.detail.time });
      }),
    );

    // Subscribe to day advancement (could update UI to show day indicator)
    this._unsubscribers.push(
      eventBus.on(EVENTS.DAY_ADVANCED, (e) => {
        this.update({ time: e.detail.time });
      }),
    );

    // Battery updates from BatteryContext
    this._unsubscribers.push(
      eventBus.on(EVENTS.BATTERY_CHANGED, (e) => {
        this.update({ battery: e.detail.battery });
      }),
    );

    // Notification count from drawer (drawer is SSOT)
    this._onDrawerCountChanged = (e) => this.updateDrawerCount(e.detail.count);
    document.addEventListener(
      'drawer-count-changed',
      this._onDrawerCountChanged,
    );
  }

  /**
   * Update status bar state
   * @param {Partial<import('../types.js').PhoneStatus>} updates
   */
  update(updates) {
    if (updates.time !== undefined) {
      this._state.time = updates.time;
    }
    if (updates.battery !== undefined) {
      this._state.battery = Math.max(0, Math.min(100, updates.battery));
    }
    if (updates.signal !== undefined) {
      this._state.signal = Math.max(0, Math.min(4, updates.signal));
    }
    if (updates.internet !== undefined) {
      this._state.internet = updates.internet;
    }
    this.render();
  }

  /**
   * Get current state (for persistence)
   * @returns {import('../types.js').PhoneStatus}
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Update drawer notification count (drawer is SSOT for notification state)
   * @param {number} count
   */
  updateDrawerCount(count) {
    this._drawerCount = count;
    this.render();
  }

  /**
   * Get notification count (from drawer SSOT)
   * @returns {number}
   */
  get notificationCount() {
    return this._drawerCount;
  }

  render() {
    const { time, battery, signal, internet } = this._state;

    const batteryIcon = getBatteryIcon(battery);
    const batteryPercent = Math.round(battery);
    const batteryColor =
      battery <= 20 ? 'var(--ink-color-danger)' : 'currentColor';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          height: var(--ink-statusbar-height, 44px);
          background: var(--ink-statusbar-bg, transparent);
          color: var(--ink-color-text, #f2f2f7);
          font-size: 14px;
          font-family: var(--ink-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
          user-select: none;
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

        .icon {
          font-size: 16px;
        }

        .status-bar-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 100%;
          padding: 0 var(--ink-space-md, 15px);
          padding-bottom: 6px; /* Space for pull handle */
          background: none;
          border: none;
          color: inherit;
          font: inherit;
          cursor: pointer;
          box-sizing: border-box;
        }

        .status-bar-btn:hover {
          background: rgba(255, 255, 255, 0.03); /* lint-ignore: subtle hover */
        }

        .status-bar-btn:active {
          background: rgba(255, 255, 255, 0.06); /* lint-ignore: subtle active */
        }

        .status-bar-btn:focus-visible {
          outline: 2px solid var(--ink-color-accent, #0a84ff);
          outline-offset: -2px;
        }

        .left, .right {
          display: flex;
          align-items: center;
          gap: var(--ink-space-sm, 8px);
        }

        .left {
          justify-content: flex-start;
        }

        .right {
          justify-content: flex-end;
          gap: 6px;
        }

        .time {
          font-family: 'Inter', var(--ink-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
          font-weight: 500;
          font-size: 13px;
          letter-spacing: 0.2px;
        }

        .signal {
          display: flex;
          align-items: center;
          margin-right: 2px;
        }

        .internet {
          display: flex;
          align-items: center;
        }

        .battery-wrap {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .battery-icon {
          font-size: 18px;
          transform: scaleX(1.15);
          color: ${batteryColor};
        }

        .battery-percent {
          font-family: 'Inter', var(--ink-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
          font-size: 11px;
          font-weight: 600;
          color: ${batteryColor};
        }

        .notification-badge {
          background: var(--ink-color-accent, #0a84ff);
          color: white;
          font-size: 11px;
          font-weight: 600;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Pull handle - subtle down arrow along bottom edge */
        .pull-handle {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px 0;
          pointer-events: none;
        }

        .pull-chevrons {
          display: flex;
          opacity: 0.2;
          transition: opacity 0.3s ease, color 0.3s ease;
          color: currentColor;
        }

        .pull-chevrons svg {
          width: 54px;
          height: 5px;
        }

        .status-bar-btn:hover .pull-chevrons {
          opacity: 0.5;
          color: #fff; /* lint-ignore: pull handle hover */
        }

      </style>

      <button class="status-bar-btn" aria-label="Open notification shade${this.notificationCount > 0 ? ` (${this.notificationCount} notifications)` : ''}">
        <div class="left">
          <span class="time">${escapeHtml(time)}</span>
          ${this.notificationCount > 0 ? `<span class="notification-badge">${this.notificationCount}</span>` : ''}
        </div>

        <div class="right">
          <span class="signal"><span class="material-symbols-outlined icon" aria-hidden="true">${getSignalIcon(signal)}</span></span>
          ${internet && internet !== 'none' ? `<span class="internet">${renderInternetIcon(internet)}</span>` : ''}
          <span class="battery-wrap" aria-label="Battery ${batteryPercent}%">
            <span class="material-symbols-outlined icon battery-icon" aria-hidden="true">${batteryIcon}</span>
            <span class="battery-percent">${batteryPercent}</span>
          </span>
        </div>

        <!-- Pull handle hint -->
        <div class="pull-handle" aria-hidden="true">
          <div class="pull-chevrons">
            <svg viewBox="0 0 54 5" aria-hidden="true"><path d="M0 0 L27 4 L54 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>
      </button>
    `;

    // Wire click handler
    this.shadowRoot
      .querySelector('.status-bar-btn')
      ?.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('drawer-open-requested', { bubbles: true }),
        );
      });
  }
}

customElements.define('phone-status-bar', PhoneStatusBar);
