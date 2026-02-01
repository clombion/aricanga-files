// Conversation Event Payload Factories
// Single source of truth for EventBus payload shapes in conversation plugin

// Re-export foundation factories for convenience
export {
  createDataErrorEvent,
  createDataRequestEvent,
  createDataResponseEvent,
  createTimeEvent,
} from '../../../foundation/services/event-factories.js';

/**
 * Validates required field exists, logs error if missing
 * @param {*} value - The value to check
 * @param {string} name - Field name for error message
 * @returns {*} The original value (even if invalid, to avoid breaking flow)
 */
const required = (value, name) => {
  if (value === undefined || value === null) {
    console.error(
      `[ConversationPlugin] Event factory: missing required field "${name}"`,
    );
  }
  return value;
};

// ============================================================================
// Message Events
// ============================================================================

/**
 * Create conv:message-received event payload
 * @param {string} chatId - Target chat identifier
 * @param {object} message - Message object
 * @param {boolean} [isCurrentChat=false] - Whether this is the currently viewed chat
 */
export const createMessageEvent = (chatId, message, isCurrentChat = false) => ({
  chatId: required(chatId, 'chatId'),
  message: required(message, 'message'),
  isCurrentChat: Boolean(isCurrentChat),
});

/**
 * Create os:message-receipt-changed event payload
 * @param {string} chatId - Chat containing the message
 * @param {string} label - Label of the target message
 * @param {string} receipt - New receipt status ('sent', 'delivered', 'read')
 */
export const createReceiptChangedEvent = (chatId, label, receipt) => ({
  chatId: required(chatId, 'chatId'),
  label: required(label, 'label'),
  receipt: required(receipt, 'receipt'),
});

// ============================================================================
// Notification Events
// ============================================================================

/**
 * Create conv:notification-show event payload
 * @param {string} chatId - Source chat identifier
 * @param {string} preview - Preview text for notification
 * @param {string} [title] - Optional title override (defaults to chat title)
 */
export const createNotificationEvent = (chatId, preview, title = null) => ({
  chatId: required(chatId, 'chatId'),
  preview: required(preview, 'preview'),
  ...(title && { title }),
});

// ============================================================================
// Typing Events
// ============================================================================

/**
 * Create conv:typing-start event payload
 * @param {string} chatId - Chat where typing occurs
 * @param {string} [speaker] - Who is typing (optional)
 */
export const createTypingStartEvent = (chatId, speaker = null) => ({
  chatId: required(chatId, 'chatId'),
  ...(speaker && { speaker }),
});

/**
 * Create conv:typing-end event payload
 * @param {string} chatId - Chat where typing stopped
 */
export const createTypingEndEvent = (chatId) => ({
  chatId: required(chatId, 'chatId'),
});

// ============================================================================
// Presence Events
// ============================================================================

/**
 * Create conv:presence-changed event payload
 * @param {string} chatId - Chat whose presence changed
 * @param {string} status - New presence status ('online', 'offline', 'lastseen:TIME')
 */
export const createPresenceEvent = (chatId, status) => ({
  chatId: required(chatId, 'chatId'),
  status: required(status, 'status'),
});

// ============================================================================
// Chat Events
// ============================================================================

/**
 * Create conv:chat-opened event payload
 * @param {string} chatId - Opened chat identifier
 * @param {Array} [messages=[]] - Initial message history
 * @param {number} [deferredCount=0] - Number of deferred messages pending replay
 */
export const createChatOpenedEvent = (
  chatId,
  messages = [],
  deferredCount = 0,
) => ({
  chatId: required(chatId, 'chatId'),
  messages: Array.isArray(messages) ? messages : [],
  deferredCount: typeof deferredCount === 'number' ? deferredCount : 0,
});

/**
 * Create conv:choices-available event payload
 * @param {Array} [choices=[]] - Available choices from story
 */
export const createChoicesEvent = (choices = []) => ({
  choices: Array.isArray(choices) ? choices : [],
});

// ============================================================================
// Battery Events (Phone-specific)
// ============================================================================

/**
 * Create conv:battery-changed event payload
 * @param {number} battery - Battery percentage (0-100)
 * @param {boolean} [isLow=false] - Whether battery is critically low
 */
export const createBatteryEvent = (battery, isLow = false) => ({
  battery: required(battery, 'battery'),
  isLow: Boolean(isLow),
});

// ============================================================================
// Theme Events
// ============================================================================

/**
 * Create os:theme-changed event payload
 * @param {string} oldTheme - Previous theme value ('light', 'dark', 'system')
 * @param {string} newTheme - New theme value ('light', 'dark', 'system')
 * @param {string} effectiveTheme - Resolved theme ('light' or 'dark')
 */
export const createThemeChangedEvent = (
  oldTheme,
  newTheme,
  effectiveTheme,
) => ({
  oldTheme: required(oldTheme, 'oldTheme'),
  newTheme: required(newTheme, 'newTheme'),
  effectiveTheme: required(effectiveTheme, 'effectiveTheme'),
  timestamp: Date.now(),
});
