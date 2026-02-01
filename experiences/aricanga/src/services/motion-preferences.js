/**
 * Motion Preferences Service
 *
 * Controls page transition animation level with three options:
 * - full: Default slide animations
 * - reduced: Simple fade in/out
 * - off: Instant swap (no animation)
 *
 * "Most restrictive wins" behavior:
 * If OS has prefers-reduced-motion enabled, effective level is at least 'reduced'
 */

import { eventBus } from '@narratives/framework';

export const MOTION_LEVELS = {
  FULL: 'full',
  REDUCED: 'reduced',
  OFF: 'off',
};

export const MOTION_EVENTS = {
  MOTION_CHANGED: 'motion-changed',
};

const STORAGE_KEY = 'cc-motion';

/**
 * Check if OS prefers reduced motion
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Motion preferences singleton
 */
export const motionPrefs = {
  /**
   * User-selected motion level
   * @type {'full'|'reduced'|'off'}
   */
  level: MOTION_LEVELS.FULL,

  /**
   * Initialize motion preferences from localStorage
   */
  init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Object.values(MOTION_LEVELS).includes(saved)) {
      this.level = saved;
    }
    console.log(`[motion] Initialized with level: ${this.level}`);
  },

  /**
   * Set motion level and persist to localStorage
   * @param {'full'|'reduced'|'off'} newLevel
   */
  setLevel(newLevel) {
    if (!Object.values(MOTION_LEVELS).includes(newLevel)) {
      console.error(`[motion] Unknown level: ${newLevel}`);
      return;
    }

    if (newLevel === this.level) {
      return;
    }

    const oldLevel = this.level;
    this.level = newLevel;
    localStorage.setItem(STORAGE_KEY, newLevel);

    eventBus.emit(MOTION_EVENTS.MOTION_CHANGED, {
      oldLevel,
      newLevel,
      effectiveLevel: this.getEffectiveLevel(),
    });

    console.log(`[motion] Level changed: ${oldLevel} → ${newLevel}`);
  },

  /**
   * Get effective motion level, considering OS preference
   * "Most restrictive wins": OS reduced-motion sets floor at 'reduced'
   * @returns {'full'|'reduced'|'off'}
   */
  getEffectiveLevel() {
    // User explicitly set 'off' - honor that regardless of OS
    if (this.level === MOTION_LEVELS.OFF) {
      return MOTION_LEVELS.OFF;
    }

    // OS wants reduced motion - floor at 'reduced'
    if (prefersReducedMotion() && this.level === MOTION_LEVELS.FULL) {
      return MOTION_LEVELS.REDUCED;
    }

    return this.level;
  },
};
