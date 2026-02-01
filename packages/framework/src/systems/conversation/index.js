// Conversation System - Public API exports

// System API
export { conversationSystem } from './conversation-system.js';

// Component registration — deferred to prevent Render-Before-Ready (BUG-002).
// Consumers call this AFTER services (i18n, config) are registered.
export async function registerConversationComponents() {
  await import('./components/index.js');
}

// Events
export { CONV_EVENTS, EVENTS } from './events/events.js';
export {
  createChatOpenedEvent,
  createChoicesEvent,
  createDataRequestEvent,
  createMessageEvent,
  createNotificationEvent,
  createPresenceEvent,
  createReceiptChangedEvent,
  createThemeChangedEvent,
  createTypingEndEvent,
  createTypingStartEvent,
} from './events/factories.js';
// Ink external functions (shared between runtime and build-time)
export {
  bindExternalFunctions,
  createBuildExternalFunctions,
  createExternalFunctions,
} from './ink/external-functions.js';
// Services
export { BatteryContext, batteryContext } from './services/battery-context.js';
// State machine factory and default instance
export {
  chatStateMachine,
  createChatMachine,
  createConversationMachine,
} from './state/chat-machine.js';
// Pure helper functions for state machine (testable)
export {
  buildStatusMessage,
  extractStoryBoundary,
  getTargetChat,
  isDuplicateMessage,
  resolveDelay,
  shouldBufferMessage,
  validateTargetChat,
} from './state/chunk-helpers.js';
// Tag handlers (re-exported for direct access if needed)
export { tagHandlers } from './tags/index.js';
// Type factories and guards
export {
  createAttachmentMessage,
  createAudioMessage,
  createImageMessage,
  createLinkPreviewMessage,
  createTextMessage,
  isAttachmentMessage,
  isAudioMessage,
  isImageMessage,
  isLinkPreviewMessage,
  isTextMessage,
  parseMessage,
} from './types.js';
export {
  MOTION_LEVELS,
  TRANSITIONS,
  transitionViews,
} from './utils/view-transitions.js';
// Utilities
export { parseTags } from './utils.js';
