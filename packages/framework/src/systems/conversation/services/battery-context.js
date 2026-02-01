// Battery Context - Phone-specific battery simulation
// Part of Conversation Plugin (not foundation)
//
// Battery is a phone/device concept, not a foundation concept.
// This service extends TimeContext with battery drain.

import { eventBus } from '../../../foundation/services/event-bus.js';
import { createBatteryChangedEvent } from '../../../foundation/services/event-factories.js';
import { timeContext } from '../../../foundation/services/time-context.js';
import { EVENTS } from '../events/events.js';

/**
 * BatteryContext manages phone battery with:
 * - Drain over time (linked to TimeContext)
 * - Low battery warnings
 * - Manual battery setting (e.g., charging events)
 *
 * Usage:
 * ```js
 * import { batteryContext } from './battery-context.js';
 *
 * batteryContext.configure({
 *   startBattery: 100,
 *   drainPerHour: 6.94,
 *   lowBatteryThreshold: 20,
 * });
 * ```
 */
export class BatteryContext {
  /**
   * @param {Object} options
   * @param {number} [options.startBattery=100] - Starting battery percentage
   * @param {number} [options.drainPerHour=6.94] - Battery drain per hour (~14 hours to drain)
   * @param {number} [options.lowBatteryThreshold=20] - Warning threshold
   */
  constructor(options = {}) {
    this._battery = options.startBattery ?? 100;
    this._drainPerMinute = (options.drainPerHour ?? 6.94) / 60;
    this._lowBatteryThreshold = options.lowBatteryThreshold ?? 20;
    this._lastBatteryEmitted = this._battery;
    this._configured = false;
  }

  /**
   * Configure battery options
   * @param {Object} options
   * @param {number} [options.startBattery] - Starting battery percentage
   * @param {number} [options.drainPerHour] - Battery drain per hour
   * @param {number} [options.lowBatteryThreshold] - Warning threshold
   */
  configure(options = {}) {
    if (options.startBattery !== undefined) {
      this._battery = options.startBattery;
      this._lastBatteryEmitted = options.startBattery;
    }
    if (options.drainPerHour !== undefined) {
      this._drainPerMinute = options.drainPerHour / 60;
    }
    if (options.lowBatteryThreshold !== undefined) {
      this._lowBatteryThreshold = options.lowBatteryThreshold;
    }
    this._configured = true;
  }

  /**
   * Connect to TimeContext to drain battery on time advance
   * Call this after configure() to start automatic drain
   */
  connectToTimeContext() {
    timeContext.onTimeAdvance((minutes) => {
      this._applyDrain(minutes);
    });
  }

  /**
   * Get current battery level (rounded)
   * @returns {number} 0-100
   */
  get level() {
    return Math.max(0, Math.round(this._battery));
  }

  /**
   * Check if battery is below warning threshold
   * @returns {boolean}
   */
  get isLow() {
    return this._battery <= this._lowBatteryThreshold;
  }

  /**
   * Set battery level directly (for story events like "phone charging")
   * @param {number} level - Battery level 0-100
   */
  setBattery(level) {
    this._battery = Math.max(0, Math.min(100, level));
    const currentLevel = this.level;
    if (currentLevel !== this._lastBatteryEmitted) {
      this._lastBatteryEmitted = currentLevel;
      this._emitBatteryChanged();
    }
  }

  /**
   * Get current state for serialization
   * @returns {{battery: number}}
   */
  getState() {
    return {
      battery: this.level,
    };
  }

  /**
   * Restore state from serialized data
   * @param {{battery?: number}} state
   */
  restoreState(state) {
    if (state.battery !== undefined) {
      this._battery = state.battery;
      this._lastBatteryEmitted = state.battery;
    }
  }

  /**
   * Apply battery drain for time advancement
   * @param {number} minutes - Minutes elapsed
   * @private
   */
  _applyDrain(minutes) {
    if (minutes <= 0) return;

    const drain = minutes * this._drainPerMinute;
    this._battery = Math.max(0, this._battery - drain);

    // Emit only when the rounded level changes
    const currentLevel = this.level;
    if (currentLevel !== this._lastBatteryEmitted) {
      this._lastBatteryEmitted = currentLevel;
      this._emitBatteryChanged();
    }
  }

  /**
   * Emit battery changed event
   * @private
   */
  _emitBatteryChanged() {
    eventBus.emit(
      EVENTS.BATTERY_CHANGED,
      createBatteryChangedEvent(this.level, this.isLow),
    );
  }
}

// Singleton instance for conversation plugin
export const batteryContext = new BatteryContext();
