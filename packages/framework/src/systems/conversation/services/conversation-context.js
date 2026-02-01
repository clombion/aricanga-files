// Conversation Context - Accessor functions for config and i18n
// Decouples conversation components from specific implementations
//
// Components import these accessors instead of directly importing from
// experiences/{impl}/. The implementation registers services at
// startup, and these accessors safely retrieve them with fallbacks.

import { contextRegistry } from '../../../foundation/services/context-registry.js';

// ============================================================
// i18n Accessors
// ============================================================

/**
 * Translate a key with optional variable interpolation
 * @param {string} key - Dot-notation key path (e.g., 'hub.pinned')
 * @param {Object} [vars] - Variables for interpolation
 * @returns {string} Translated string, or key if not found
 */
export const t = (key, vars) => {
  const i18n = contextRegistry.get('i18n');
  return i18n?.t(key, vars) ?? key;
};

/**
 * Get localized name variant for entity or character
 * @param {string} id - Entity or character ID
 * @param {string} [variant='short'] - Name variant
 * @returns {string} Localized name, or id if not found
 */
export const getName = (id, variant = 'short') => {
  const i18n = contextRegistry.get('i18n');
  return i18n?.getName?.(id, variant) ?? id;
};

/**
 * i18n events for locale change notifications
 */
export const I18N_EVENTS = {
  LOCALE_READY: 'locale-ready',
  LOCALE_CHANGING: 'locale-changing',
  LOCALE_CHANGED: 'locale-changed',
};

// ============================================================
// Config Accessors
// ============================================================

/**
 * Get a chat configuration by ID
 * @param {string} id - Chat ID
 * @returns {Object|undefined} Chat config or undefined
 */
export const getChat = (id) => {
  const config = contextRegistry.get('config');
  return config?.chats?.[id];
};

/**
 * Get all chat IDs in display order
 * @returns {string[]} Array of chat IDs
 */
export const getChatIds = () => {
  const config = contextRegistry.get('config');
  return config?.chatIds ?? [];
};

/**
 * Get app configuration
 * @returns {Object} App config with name, iconLetter, etc.
 */
export const getApp = () => {
  const config = contextRegistry.get('config');
  return config?.app ?? {};
};

/**
 * Get a UI timing value
 * @param {string} key - Timing key (e.g., 'typingDelay')
 * @returns {number|undefined} Timing value in ms
 */
export const getUITiming = (key) => {
  const config = contextRegistry.get('config');
  return config?.ui?.timings?.[key];
};

/**
 * Get a UI dimension value
 * @param {string} key - Dimension key (e.g., 'imageMaxWidth')
 * @returns {number|undefined} Dimension value
 */
export const getUIDimension = (key) => {
  const config = contextRegistry.get('config');
  return config?.ui?.dimensions?.[key];
};

/**
 * Get a chat type configuration by ID
 * @param {string} id - Chat type ID
 * @returns {Object|undefined} Chat type config or undefined
 */
export const getChatType = (id) => {
  const config = contextRegistry.get('config');
  return config?.chatTypes?.[id];
};

/**
 * Get all chat types
 * @returns {Object} Map of chat type ID to config
 */
export const getChatTypes = () => {
  const config = contextRegistry.get('config');
  return config?.chatTypes ?? {};
};

/**
 * Get all chats configuration
 * @returns {Object} Map of chat ID to config
 */
export const getChats = () => {
  const config = contextRegistry.get('config');
  return config?.chats ?? {};
};

/**
 * Get current locale code
 * @returns {string} Locale code (e.g., 'en', 'fr')
 */
export const getLocale = () => {
  const i18n = contextRegistry.get('i18n');
  return i18n?.locale ?? 'en';
};

/**
 * Get UI strings for dialogs/messages
 * @returns {Object} UI strings config
 */
export const getUIStrings = () => {
  const config = contextRegistry.get('config');
  return config?.ui?.strings ?? {};
};

/**
 * Get start state configuration (date, weather, temperature, etc.)
 * @returns {Object} Start state config
 */
export const getStartState = () => {
  const config = contextRegistry.get('config');
  return config?.startState ?? {};
};

/**
 * Register a one-shot callback for when config becomes available.
 * Fires immediately if already registered.
 * @param {function} callback - Called with the config object
 */
export const onConfigReady = (callback) => {
  contextRegistry.onRegister('config', callback);
};
