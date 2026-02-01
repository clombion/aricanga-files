// Conversation Plugin Components
//
// These components implement the phone-style messaging UI:
// - Chat navigation (hub ↔ thread)
// - Message display with bubbles, images, audio
// - Typing indicators
// - Notifications (popup and drawer)
// - Phone status bar (time, battery, signal)
//
// Components self-register as Custom Elements when imported.

// Note: Components export named classes and self-register.
// Import side-effects register them with customElements.

// Message Bubble Components
export { AudioBubble } from './audio-bubble.js';
// Chat UI Components
export { ChatHub } from './chat-hub.js';
export { UnreadSeparator } from './chat-thread/unread-separator.js';
export { ChatThread } from './chat-thread.js';
export { ConnectionOverlay } from './connection-overlay.js';
export { ConversationSettings } from './conversation-settings.js';
// Navigation Components
export { HomeIndicator } from './home-indicator.js';
export { ImageBubble } from './image-bubble.js';
// Link Preview Component
export { LinkPreview } from './link-preview.js';
export { LockScreen } from './lock-screen.js';
export { NotificationDrawer } from './notification-drawer.js';
// Notification Components
export { NotificationPopup } from './notification-popup.js';
// Status Components
export { PhoneStatusBar } from './phone-status-bar.js';
// Player Profile
export { PlayerProfile } from './player-profile.js';
export { TypingIndicator } from './typing-indicator.js';

/**
 * Register all conversation plugin components
 * Call this to ensure all custom elements are defined
 */
export function registerComponents() {
  // Components self-register when imported, but we can verify they exist
  const expectedElements = [
    'chat-hub',
    'chat-thread',
    'chat-header',
    'choice-buttons',
    'conversation-banner',
    'conversation-settings',
    'player-profile',
    'date-separator',
    'unread-separator',
    'audio-bubble',
    'image-bubble',
    'link-preview',
    'notification-popup',
    'notification-drawer',
    'phone-status-bar',
    'typing-indicator',
    'connection-overlay',
    'home-indicator',
    'settings-page',
    'debug-panel',
    'lock-screen',
  ];

  const registered = expectedElements.filter(
    (name) => customElements.get(name) !== undefined,
  );

  console.log(
    `[ConversationPlugin] ${registered.length}/${expectedElements.length} components registered`,
  );

  return registered;
}
