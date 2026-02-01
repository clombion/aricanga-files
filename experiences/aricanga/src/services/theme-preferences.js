/**
 * Theme Preferences Service
 *
 * Controls app theme with three options:
 * - light: Light mode
 * - dark: Dark mode (default)
 * - system: Follow OS preference
 *
 * Applies `data-theme="light|dark"` to <html> for CSS targeting.
 */

import {
  createThemeChangedEvent,
  EVENTS,
  eventBus,
} from '@narratives/framework';

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

const STORAGE_KEY = 'cc-theme';

/**
 * Check if OS prefers dark color scheme
 * @returns {boolean}
 */
function prefersDarkMode() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Theme preferences singleton
 */
export const themePrefs = {
  /**
   * User-selected theme
   * @type {'light'|'dark'|'system'}
   */
  theme: THEMES.DARK,

  /**
   * Media query for system preference changes
   * @type {MediaQueryList|null}
   */
  _mediaQuery: null,

  /**
   * Bound handler for media query changes
   * @type {Function|null}
   */
  _mediaHandler: null,

  /**
   * Initialize theme preferences from localStorage
   */
  init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Object.values(THEMES).includes(saved)) {
      this.theme = saved;
    }

    // Apply initial theme
    this._applyTheme();

    // Listen for OS preference changes (only matters when theme is 'system')
    this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this._mediaHandler = () => {
      if (this.theme === THEMES.SYSTEM) {
        this._applyTheme();
        eventBus.emit(
          EVENTS.THEME_CHANGED,
          createThemeChangedEvent(
            this.theme,
            this.theme,
            this.getEffectiveTheme(),
          ),
        );
      }
    };
    this._mediaQuery.addEventListener('change', this._mediaHandler);

    console.log(
      `[theme] Initialized with theme: ${this.theme} (effective: ${this.getEffectiveTheme()})`,
    );
  },

  /**
   * Set theme and persist to localStorage
   * @param {'light'|'dark'|'system'} newTheme
   */
  setTheme(newTheme) {
    if (!Object.values(THEMES).includes(newTheme)) {
      console.error(`[theme] Unknown theme: ${newTheme}`);
      return;
    }

    if (newTheme === this.theme) {
      return;
    }

    const oldTheme = this.theme;
    this.theme = newTheme;
    localStorage.setItem(STORAGE_KEY, newTheme);

    this._applyTheme();

    eventBus.emit(
      EVENTS.THEME_CHANGED,
      createThemeChangedEvent(oldTheme, newTheme, this.getEffectiveTheme()),
    );

    console.log(`[theme] Theme changed: ${oldTheme} -> ${newTheme}`);
  },

  /**
   * Toggle between light and dark (skips system)
   */
  toggleTheme() {
    const effective = this.getEffectiveTheme();
    const newTheme = effective === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    this.setTheme(newTheme);
  },

  /**
   * Get effective theme, resolving 'system' to actual value
   * @returns {'light'|'dark'}
   */
  getEffectiveTheme() {
    if (this.theme === THEMES.SYSTEM) {
      return prefersDarkMode() ? THEMES.DARK : THEMES.LIGHT;
    }
    return this.theme;
  },

  /**
   * Apply theme to DOM
   * @private
   */
  _applyTheme() {
    const effective = this.getEffectiveTheme();
    document.documentElement.setAttribute('data-theme', effective);
  },

  /**
   * Cleanup listeners (for testing)
   */
  destroy() {
    if (this._mediaQuery && this._mediaHandler) {
      this._mediaQuery.removeEventListener('change', this._mediaHandler);
    }
  },
};
