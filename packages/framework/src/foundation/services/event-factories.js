/**
 * Foundation Event Factories
 *
 * Core event payload factories for vocabulary-agnostic events.
 * These factories are used across the foundation layer.
 *
 * Conversation-specific factories (message, notification, typing, etc.)
 * live in src/systems/conversation/events/factories.js
 */

/**
 * Validates required field exists, logs error if missing
 * @param {*} value - The value to check
 * @param {string} name - Field name for error message
 * @returns {*} The original value (even if invalid, to avoid breaking flow)
 */
export const required = (value, name) => {
  if (value === undefined || value === null) {
    console.error(`Event factory: missing required field "${name}"`);
  }
  return value;
};

// ============================================================================
// Time Events
// ============================================================================

/**
 * Create TIME_UPDATED or DAY_ADVANCED event payload
 * @param {string} time - Current time string (e.g., "9:23 AM")
 * @param {number} day - Current day number
 */
export const createTimeEvent = (time, day) => ({
  time: required(time, 'time'),
  day: required(day, 'day'),
});

// ============================================================================
// Data Events
// ============================================================================

/**
 * Create DATA_REQUESTED event payload
 * @param {string} requestId - Unique request identifier for correlation
 * @param {string} source - Data source identifier
 * @param {string} query - Query type
 * @param {object} [params={}] - Query parameters
 */
export const createDataRequestEvent = (
  requestId,
  source,
  query,
  params = {},
) => ({
  requestId: required(requestId, 'requestId'),
  source: required(source, 'source'),
  query: required(query, 'query'),
  params,
});

/**
 * Create DATA_RECEIVED event payload
 * @param {string} requestId - Matching request identifier
 * @param {string} source - Data source identifier
 * @param {string} query - Original query type
 * @param {object} params - Original query parameters
 * @param {object} data - Response data
 */
export const createDataResponseEvent = (
  requestId,
  source,
  query,
  params,
  data,
) => ({
  requestId: required(requestId, 'requestId'),
  source,
  query,
  params,
  data: required(data, 'data'),
});

/**
 * Create DATA_ERROR event payload
 * @param {string} requestId - Matching request identifier
 * @param {string} source - Data source identifier
 * @param {string} query - Original query type
 * @param {object} params - Original query parameters
 * @param {Error|string} error - Error object or message
 */
export const createDataErrorEvent = (
  requestId,
  source,
  query,
  params,
  error,
) => ({
  requestId: required(requestId, 'requestId'),
  source,
  query,
  params,
  error: required(error, 'error'),
});

// ============================================================================
// Locale Events
// ============================================================================

/**
 * Create LOCALE_READY event payload
 * @param {string} locale - Current locale code
 */
export const createLocaleReadyEvent = (locale) => ({
  locale: required(locale, 'locale'),
});

/**
 * Create LOCALE_CHANGING event payload
 * @param {string} from - Previous locale code
 * @param {string} to - New locale code
 */
export const createLocaleChangingEvent = (from, to) => ({
  from: required(from, 'from'),
  to: required(to, 'to'),
});

/**
 * Create LOCALE_CHANGED event payload
 * @param {string} from - Previous locale code
 * @param {string} to - New locale code
 */
export const createLocaleChangedEvent = (from, to) => ({
  from: required(from, 'from'),
  to: required(to, 'to'),
});

// ============================================================================
// Conversation Events
// ============================================================================

/**
 * Create conv:message-received event payload
 * @param {string} chatId - Chat identifier
 * @param {object} message - Message data
 */
export const createMessageReceivedEvent = (chatId, message) => ({
  chatId: required(chatId, 'chatId'),
  message: required(message, 'message'),
});

/**
 * Create BATTERY_CHANGED event payload
 * @param {number} battery - Battery level 0-100
 * @param {boolean} isLow - Whether battery is below warning threshold
 */
export const createBatteryChangedEvent = (battery, isLow) => ({
  battery: required(battery, 'battery'),
  isLow: required(isLow, 'isLow'),
});
