// Time Context - Day-based time simulation with Drift & Snap
// Part of vocabulary-agnostic foundation layer
// Manages story time with auto-advance (drift) and explicit time tags (snap)
// NOTE: Battery tracking removed - that's phone-specific (lives in conversation plugin)

import { eventBus } from './event-bus.js';
import { createTimeEvent } from './event-factories.js';

/**
 * Foundation time events
 * NOTE: These match the unified EVENTS constant (os: prefix)
 * to ensure components can subscribe to these events via EVENTS.TIME_UPDATED, etc.
 */
export const TIME_EVENTS = {
  DAY_ADVANCED: 'os:day-advanced',
  TIME_UPDATED: 'os:time-updated',
};

/**
 * Parse time string to Date object
 * @param {string} timeStr - e.g., "10:41 AM" or "10:41"
 * @returns {Date}
 */
function parseTime(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return new Date();

  let [, hours, minutes, period] = match;
  let h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);

  if (period) {
    period = period.toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
  }

  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date;
}

/**
 * Format Date to display time string
 * @param {Date} date
 * @param {string} [locale='en'] - Locale for formatting
 * @returns {string} e.g., "10:41 AM" (en) or "10:41" (fr)
 */
function formatTime(date, locale = 'en') {
  return date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * TimeContext manages story time with:
 * - Drift: Auto +1 minute per message (default)
 * - Snap: Explicit time setting via # time:HH:MM tags
 * - Duration: Explicit time jump via # duration:N tags
 * - Day advancement: Next day resets to morning
 *
 * Ghost Time: Clock only advances on messages, not player choices
 *
 * NOTE: This foundation version does NOT include battery.
 * Battery is phone-specific and lives in the conversation plugin.
 */
export class TimeContext {
  /**
   * @param {Object} options
   * @param {number} [options.startDay=1] - Starting day number
   * @param {string} [options.startTime='9:00 AM'] - Starting time
   * @param {number} [options.defaultDrift=1] - Minutes to add per message
   * @param {string} [options.locale='en'] - Locale for time formatting
   */
  // Session tracking for analytics
  #sessionStart = Date.now();

  constructor(options = {}) {
    this.currentDay = options.startDay ?? 1;
    this.currentTime = parseTime(options.startTime ?? '9:00 AM');
    this.defaultDrift = options.defaultDrift ?? 1;
    this._locale = options.locale ?? 'en';
    this._initialized = false;

    // Extension point for plugins (e.g., battery drain)
    this._timeAdvanceCallbacks = [];
  }

  /**
   * Set locale for time formatting
   * @param {string} locale
   */
  setLocale(locale) {
    this._locale = locale;
  }

  /**
   * Register a callback to run when time advances
   * Plugins can use this to implement features like battery drain
   * @param {function(number): void} callback - Called with minutes elapsed
   */
  onTimeAdvance(callback) {
    this._timeAdvanceCallbacks.push(callback);
  }

  /**
   * Initialize with first time from story (prevents drift on first message)
   * @param {string} timeStr
   */
  initialize(timeStr) {
    if (timeStr) {
      this.currentTime = parseTime(timeStr);
    }
    this._initialized = true;
  }

  /**
   * Check if TimeContext has been initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Auto-advance time by default drift (called on each message without time tag)
   * @param {number} [minutes] - Override drift amount
   */
  tick(minutes) {
    const drift = minutes ?? this.defaultDrift;
    this.currentTime = new Date(this.currentTime.getTime() + drift * 60000);
    this._notifyTimeAdvance(drift);
    this._emitTimeUpdated();
  }

  /**
   * Advance time by explicit duration (called for # duration:N tags)
   * @param {number} minutes - Minutes to add
   */
  advance(minutes) {
    this.currentTime = new Date(this.currentTime.getTime() + minutes * 60000);
    this._notifyTimeAdvance(minutes);
    this._emitTimeUpdated();
  }

  /**
   * Set exact time (called for # time:HH:MM tags - hard snap)
   * Only advances forward; ignores times earlier than current (cross-chat coherence)
   * @param {string} timeStr - Time string to set
   * @returns {boolean} true if time was set, false if rejected (backward)
   */
  setTime(timeStr) {
    const newTime = parseTime(timeStr);
    // Only advance forward, never backward (maintains coherence across chats)
    if (!this._initialized || newTime > this.currentTime) {
      // Calculate elapsed time for plugin callbacks
      const diffMs = newTime.getTime() - this.currentTime.getTime();
      const diffMinutes = Math.max(0, diffMs / 60000);

      this.currentTime = newTime;
      this._initialized = true;
      this._notifyTimeAdvance(diffMinutes);
      this._emitTimeUpdated();
      return true;
    }
    // Warn authors when backward time is rejected
    console.warn(
      `[TimeContext] Backward time rejected: "${timeStr}" < current "${this.format()}". ` +
        `Time only moves forward. Check your # time: tags.`,
    );
    this._initialized = true;
    this._emitTimeUpdated();
    return false;
  }

  /**
   * Advance to next day, reset time to morning
   * @param {string} [morningTime='9:00 AM'] - Time to reset to
   */
  advanceDay(morningTime = '9:00 AM') {
    this.currentDay++;
    this.currentTime = parseTime(morningTime);

    eventBus.emit(
      TIME_EVENTS.DAY_ADVANCED,
      createTimeEvent(this.format(), this.currentDay),
    );
    this._emitTimeUpdated();
  }

  /**
   * Get formatted time string for display
   * @returns {string} e.g., "10:41 AM"
   */
  format() {
    return formatTime(this.currentTime, this._locale);
  }

  /**
   * Get current day number
   * @returns {number}
   */
  getDay() {
    return this.currentDay;
  }

  /**
   * Get current state for serialization
   * @returns {{day: number, time: string}}
   */
  getState() {
    return {
      day: this.currentDay,
      time: this.format(),
    };
  }

  /**
   * Get elapsed session duration in milliseconds
   * @returns {number}
   */
  getSessionDuration() {
    return Date.now() - this.#sessionStart;
  }

  /**
   * Reset session timer (call on game reset/new session)
   */
  resetSessionTimer() {
    this.#sessionStart = Date.now();
  }

  /**
   * Restore state from serialized data
   * @param {{day: number, time: string}} state
   */
  restoreState(state) {
    if (state.day) this.currentDay = state.day;
    if (state.time) this.currentTime = parseTime(state.time);
    this._initialized = true;
  }

  /**
   * Process time from message tags
   * Priority: 0) pre-story (display only), 1) time tag (snap), 2) duration tag (jump), 3) auto-drift
   * @param {Object} tags - Parsed message tags
   * @param {boolean} [isStatusOnly=false] - Skip drift for status-only messages
   * @param {boolean} [storyStarted=true] - Whether # story_start has been seen
   * @returns {string|null} The time for this message, or null for seed messages
   */
  processMessageTime(tags, isStatusOnly = false, storyStarted = true) {
    // Priority 0: Before # story_start - display-only mode
    // Time tags show but don't affect TimeContext (seeds/world-building)
    if (!storyStarted) {
      // Return time for display, or null to use date separator
      return tags.time || null;
    }

    // Priority 1: Hard Snap - explicit time tag
    if (tags.time) {
      this.setTime(tags.time);
      return tags.time;
    }

    // Priority 2: Duration tag - explicit time jump
    if (tags.duration) {
      const minutes = parseInt(tags.duration, 10);
      if (!Number.isNaN(minutes)) {
        this.advance(minutes);
      }
      return this.format();
    }

    // Priority 3: Auto-drift (only for real messages, not status-only)
    if (!isStatusOnly && this._initialized) {
      this.tick();
    }

    return this.format();
  }

  /**
   * Notify plugins of time advancement
   * @param {number} minutes - Minutes elapsed
   * @private
   */
  _notifyTimeAdvance(minutes) {
    for (const callback of this._timeAdvanceCallbacks) {
      try {
        callback(minutes);
      } catch (e) {
        console.error('[TimeContext] Callback error:', e);
      }
    }
  }

  /**
   * Emit time updated event
   * @private
   */
  _emitTimeUpdated() {
    eventBus.emit(
      TIME_EVENTS.TIME_UPDATED,
      createTimeEvent(this.format(), this.currentDay),
    );
  }
}

// Singleton instance for game-wide time tracking
export const timeContext = new TimeContext();
