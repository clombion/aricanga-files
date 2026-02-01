// Unified Event Constants
// Single source of truth for all EventBus event names
// Consolidates former OS_EVENTS and CONV_EVENTS

/**
 * All events emitted through the EventBus.
 * Components subscribe to these events to react to state changes.
 *
 * Naming convention: {namespace}:{category}-{action}
 *
 * Categories:
 * - message: Chat message lifecycle
 * - notification: Alerts, badges, popups
 * - typing: Typing indicators
 * - presence: Contact presence changes
 * - chat: Chat navigation
 * - time: Clock and day progression
 * - data: External API requests/responses
 * - battery: Phone battery state
 */
export const EVENTS = {
  // === Message Events ===
  // Fired when a new message is added to any chat
  MESSAGE_RECEIVED: 'os:message-received',
  // Fired when player sends a message (choice selected)
  MESSAGE_SENT: 'os:message-sent',
  // Fired when a message's receipt status changes (e.g., delivered → read)
  MESSAGE_RECEIPT_CHANGED: 'os:message-receipt-changed',

  // === Notification Events ===
  // Fired to show a notification popup
  NOTIFICATION_SHOW: 'os:notification-show',
  // Fired when notification is dismissed
  NOTIFICATION_DISMISS: 'os:notification-dismiss',

  // === Typing Events ===
  // Fired when typing indicator should show
  TYPING_START: 'os:typing-start',
  // Fired when typing indicator should hide
  TYPING_END: 'os:typing-end',

  // === Presence Events ===
  // Fired when a contact's presence changes (online/offline)
  PRESENCE_CHANGED: 'os:presence-changed',

  // === Chat Events ===
  // Fired when a chat is opened
  CHAT_OPENED: 'os:chat-opened',
  // Fired when returning to hub
  CHAT_CLOSED: 'os:chat-closed',
  // Fired when choices become available
  CHOICES_AVAILABLE: 'os:choices-available',

  // === Time Events ===
  // Fired when day advances (day 1 → day 2)
  DAY_ADVANCED: 'os:day-advanced',
  // Fired when clock time changes
  TIME_UPDATED: 'os:time-updated',

  // === Battery Events ===
  // Fired when battery level changes
  BATTERY_CHANGED: 'os:battery-changed',

  // === Data Events (Async API) ===
  // Fired when ink requests external data
  DATA_REQUESTED: 'os:data-requested',
  // Fired when external data is received
  DATA_RECEIVED: 'os:data-received',
  // Fired when data request fails
  DATA_ERROR: 'os:data-error',

  // === Lifecycle Events ===
  // Fired when game is ready
  READY: 'os:ready',

  // === Theme Events ===
  // Fired when theme preference changes
  THEME_CHANGED: 'os:theme-changed',
};

// Backward compatibility alias (deprecated)
export const CONV_EVENTS = EVENTS;

/**
 * Event payload type documentation (for reference)
 *
 * MESSAGE_RECEIVED: { chatId, message, isCurrentChat }
 * MESSAGE_SENT: { chatId, choiceIndex, text }
 * MESSAGE_RECEIPT_CHANGED: { chatId, label, receipt }
 * NOTIFICATION_SHOW: { chatId, title, preview }
 * NOTIFICATION_DISMISS: { chatId }
 * TYPING_START: { chatId, speaker }
 * TYPING_END: { chatId }
 * PRESENCE_CHANGED: { chatId, status }
 * CHAT_OPENED: { chatId, messages }
 * CHAT_CLOSED: {}
 * CHOICES_AVAILABLE: { choices }
 * BATTERY_CHANGED: { battery, isLow }
 * READY: {}
 * THEME_CHANGED: { oldTheme, newTheme, effectiveTheme }
 */
