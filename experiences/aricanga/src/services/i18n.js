/**
 * Internationalization (i18n) Module
 *
 * Provides locale-aware string lookups with:
 * - Dot notation key access: i18n.t('hub.pinned')
 * - Variable interpolation: i18n.t('status.last_seen', { time: '9:23' })
 * - Runtime locale switching without page reload
 * - Locale persistence via localStorage
 *
 * Strings are loaded dynamically from dist/locales/{locale}.json
 */

import {
  createLocaleChangedEvent,
  createLocaleChangingEvent,
  createLocaleReadyEvent,
  eventBus,
} from '@narratives/framework';
import { CHAT_TYPES, CHATS, I18N, STRINGS } from '../config.js';

// Events emitted by i18n module
export const I18N_EVENTS = {
  LOCALE_READY: 'locale-ready',
  LOCALE_CHANGING: 'locale-changing',
  LOCALE_CHANGED: 'locale-changed',
};

const LOCALE_STORAGE_KEY = 'cc-locale';

/**
 * Get nested value from object using dot notation path
 * @param {object} obj - Object to traverse
 * @param {string} path - Dot-separated path (e.g., 'hub.pinned')
 * @returns {*} Value at path, or undefined if not found
 */
function getNestedValue(obj, path) {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * Interpolate variables in a string
 * @param {string} str - String with {variable} placeholders
 * @param {object} vars - Variables to substitute
 * @returns {string} Interpolated string
 */
function interpolate(str, vars) {
  if (!vars || typeof str !== 'string') {
    return str;
  }

  return str.replace(/\{(\w+)\}/g, (match, key) => {
    return key in vars ? vars[key] : match;
  });
}

/**
 * i18n singleton - manages locale and string lookups
 */
export const i18n = {
  /**
   * Current locale code (e.g., 'en', 'fr')
   * @type {string}
   */
  locale: I18N.locale,

  /**
   * Available locales from config
   * @type {string[]}
   */
  availableLocales: I18N.availableLocales,

  /**
   * Human-readable locale names
   * @type {Object<string, string>}
   */
  localeNames: I18N.localeNames,

  /**
   * All translatable strings (loaded dynamically)
   * @type {object}
   */
  _strings: STRINGS,

  /**
   * Whether strings have been loaded for current locale
   * @type {boolean}
   */
  _loaded: false,

  /**
   * Initialize i18n - loads strings for saved locale preference
   * @returns {Promise<void>}
   */
  async init() {
    const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    const targetLocale =
      savedLocale && this.availableLocales.includes(savedLocale)
        ? savedLocale
        : this.locale;

    // Load strings for target locale
    if (targetLocale !== this.locale || !this._loaded) {
      await this.loadLocale(targetLocale);
    }

    // Save current locale
    localStorage.setItem(LOCALE_STORAGE_KEY, this.locale);

    // Emit ready event so components can re-render with correct locale
    eventBus.emit(
      I18N_EVENTS.LOCALE_READY,
      createLocaleReadyEvent(this.locale),
    );

    console.log(`[i18n] Initialized with locale: ${this.locale}`);
  },

  /**
   * Load strings for a specific locale
   * @param {string} locale - Locale code
   * @returns {Promise<void>}
   */
  async loadLocale(locale) {
    try {
      const response = await fetch(`./src/dist/locales/${locale}.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const strings = await response.json();
      this._strings = strings;
      this.locale = locale;
      this._loaded = true;
      console.log(`[i18n] Loaded locale: ${locale}`);
    } catch (error) {
      console.error(`[i18n] Failed to load locale ${locale}:`, error);
      // Fall back to build-time strings
      this._strings = STRINGS;
      this._loaded = true;
    }
  },

  /**
   * Get translated string by key
   *
   * Supports:
   * - Dot notation: 'hub.pinned' → "Pinned"
   * - Interpolation: 'status.last_seen' + {time: '9:23'} → "last seen 9:23"
   * - Character names: 'characters.pat.display_name' → "Pat (Editor)"
   * - Chat type messages: 'chat_types.normal.system_message'
   *
   * @param {string} key - Dot-notation key path
   * @param {object} [vars] - Variables for interpolation
   * @returns {string} Translated string, or key if not found
   */
  t(key, vars = {}) {
    // First try _strings (ui.*, etc.)
    let value = getNestedValue(this._strings, key);

    // If not found in _strings, try CHATS for character data
    if (value === undefined && key.startsWith('characters.')) {
      const charPath = key.replace('characters.', '');
      const parts = charPath.split('.');
      const charId = parts[0];
      const field = parts.slice(1).join('.');

      if (CHATS[charId]) {
        // Map locale field names to config field names
        const fieldMap = {
          display_name: 'title',
          displayName: 'title',
        };
        const configField = fieldMap[field] || field;
        value = CHATS[charId][configField];
      }
    }

    // Try CHAT_TYPES for system messages
    if (value === undefined && key.startsWith('chat_types.')) {
      const typePath = key.replace('chat_types.', '');
      const parts = typePath.split('.');
      const typeId = parts[0];
      const field = parts.slice(1).join('.');

      if (CHAT_TYPES[typeId]) {
        // Map locale field names to config field names
        const fieldMap = {
          system_message: 'systemMessage',
          input_placeholder: 'inputPlaceholder',
        };
        const configField = fieldMap[field] || field;
        value = CHAT_TYPES[typeId][configField];
      }
    }

    // If still not found, return the key itself
    if (value === undefined) {
      console.warn(`[i18n] Missing translation: ${key}`);
      return key;
    }

    // Interpolate variables
    return interpolate(String(value), vars);
  },

  /**
   * Change the active locale
   *
   * Loads new strings dynamically and emits LOCALE_CHANGED event.
   * Components should listen for this event and re-render.
   *
   * @param {string} newLocale - Locale code (e.g., 'fr')
   * @returns {Promise<void>}
   */
  async setLocale(newLocale) {
    if (!this.availableLocales.includes(newLocale)) {
      console.error(`[i18n] Unknown locale: ${newLocale}`);
      return;
    }

    if (newLocale === this.locale) {
      console.log(`[i18n] Already using locale: ${newLocale}`);
      return;
    }

    const oldLocale = this.locale;
    console.log(`[i18n] Changing locale from ${oldLocale} to ${newLocale}`);

    // Emit event before change
    eventBus.emit(
      I18N_EVENTS.LOCALE_CHANGING,
      createLocaleChangingEvent(oldLocale, newLocale),
    );

    // Load new locale strings
    await this.loadLocale(newLocale);

    // Save preference
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);

    // Emit event after change - components should re-render
    eventBus.emit(
      I18N_EVENTS.LOCALE_CHANGED,
      createLocaleChangedEvent(oldLocale, newLocale),
    );
  },

  /**
   * Get the saved locale preference from localStorage
   * @returns {string|null} Saved locale or null
   */
  getSavedLocale() {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  },

  /**
   * Clear saved locale preference
   */
  clearSavedLocale() {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  },

  /**
   * Get localized name variant for entity or character
   *
   * Name variants enable natural conversation flow:
   * - Characters: first_name, last_name, formal, display_name
   * - Entities: name, short, alt
   *
   * Lookup order:
   * 1. Locale-specific override: strings.names[id][variant]
   * 2. Base config names: strings.baseNames[id][variant]
   * 3. Fallback: returns id itself
   *
   * @param {string} id - Entity or character ID (e.g., 'activist', 'aricanga')
   * @param {string} [variant='short'] - Name variant to retrieve
   * @returns {string} Localized name, or id if not found
   */
  getName(id, variant = 'short') {
    const names = this._strings.names || {};
    const baseNames = this._strings.baseNames || {};

    // Try locale override first, then base, then fallback to id
    return names[id]?.[variant] || baseNames[id]?.[variant] || id;
  },
};

/**
 * Initialization promise - resolves when i18n is ready
 * Components should await this before rendering locale-dependent content
 */
export const i18nReady = i18n.init();
