// Main entry point - Wire up controller and components

// Global error handlers — surface uncaught errors for debugging
window.addEventListener('error', (e) => {
  console.error('[Uncaught Error]', e.message, {
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    error: e.error,
  });
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Rejection]', e.reason);
});

// Framework imports
import {
  batteryContext,
  contextRegistry,
  createNavigationManager,
  createNotificationEvent,
  EVENTS,
  EventLogger,
  EventLogStore,
  eventBus,
  getAnalyticsConfig,
  isAnalyticsEnabled,
  isRemoteEnabled,
  registerConversationComponents,
  sendBatch,
  setupExitTracking,
  TRANSITIONS,
  timeContext,
} from '@narratives/framework';

// Implementation imports
import {
  ANALYTICS,
  APP,
  CHAT_IDS,
  CHAT_TYPES,
  CHATS,
  I18N,
  PHONE,
  START_STATE,
  UI,
} from './config.js';
import { GameController } from './game-controller.js';
import { initGestures } from './gestures.js';
import { dataService } from './services/data-service.js';
import { i18n, i18nReady } from './services/i18n.js';
import { motionPrefs } from './services/motion-preferences.js';
import { themePrefs } from './services/theme-preferences.js';

// ============================================================
// Register services for conversation system components
// These registrations run before components mount (connectedCallback)
// ============================================================
contextRegistry.register('i18n', i18n);
contextRegistry.register('config', {
  app: APP,
  chatIds: CHAT_IDS,
  chatTypes: CHAT_TYPES,
  chats: CHATS,
  startState: START_STATE,
  ui: UI,
});

// Wait for i18n to be ready before registering components (BUG-002 fix).
// Deferred registration ensures connectedCallback never fires before services exist.
await i18nReady;

await registerConversationComponents();
await import('./components/settings-page.js');
await import('./components/about-page.js');
await import('./components/glossary-page.js');
await import('./components/debug-panel.js');

// Initialize motion preferences
motionPrefs.init();

// Initialize theme preferences
themePrefs.init();

const controller = new GameController();

/** @returns {Element} the matched element, or throws if missing */
function requireElement(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Required element missing: <${selector}>`);
  return el;
}

// Component references
// Why: Components self-subscribe to EventBus in connectedCallback - no manual wiring needed here
const lockScreen = requireElement('lock-screen');
const hub = requireElement('chat-hub');
const thread = requireElement('chat-thread');
const conversationSettings = requireElement('conversation-settings');
const notificationDrawer = requireElement('notification-drawer');
const statusBar = requireElement('phone-status-bar');
const connectionOverlay = requireElement('connection-overlay');
const settingsPage = requireElement('settings-page');
const aboutPage = requireElement('about-page');
const glossaryPage = requireElement('glossary-page');
const playerProfile = requireElement('player-profile');

// Hide main UI until lock screen is dismissed
hub.hidden = true;
statusBar.hidden = true;

// Create transition overlay for fade effect during overlay page transitions
const transitionOverlay = document.createElement('div');
transitionOverlay.className = 'ink-transition-overlay';
transitionOverlay.hidden = true;
requireElement('#content-area').appendChild(transitionOverlay);

// ============================================================
// Navigation Manager - handles view stack and transitions
// ============================================================
const navigation = createNavigationManager({
  getMotionLevel: () => motionPrefs.getEffectiveLevel(),
  overlayElement: transitionOverlay,
});

// Initialize with lock screen as root - hub is pushed on unlock
navigation.init(lockScreen);

// Configure BatteryContext with TOML phone behavior settings
// Battery is now separate from TimeContext (phone-specific, not foundation)
batteryContext.configure({
  startBattery: START_STATE.battery,
  drainPerHour: PHONE.behavior.battery_drain_per_hour,
  lowBatteryThreshold: PHONE.behavior.low_battery_warning,
});
batteryContext.connectToTimeContext();

// Initialize status bar with start state from TOML config
statusBar.update({
  time: START_STATE.current_time,
  internet: START_STATE.internet,
  signal: START_STATE.signal,
});

// ============================================================
// Lock Screen Transitions
// Lock screen is root of navigation stack - unlock pushes hub
// ============================================================
document.addEventListener('lock-screen-unlocked', () => {
  lockScreen.stopAnimation();
  statusBar.hidden = false;
  navigation.push(hub, {
    direction: 'slide-up',
    duration: TRANSITIONS.UNLOCK.duration,
  });
});

document.addEventListener('lockscreen-requested', (e) => {
  navigation.popToRoot({
    direction: 'slide-down',
    onComplete: () => {
      statusBar.hidden = true;
      lockScreen.show(e.detail.notifications);
    },
  });
});

// ============================================================
// Analytics Setup
// ============================================================

// Load config from TOML (via generated config)
const analyticsConfig = getAnalyticsConfig({
  enabled: ANALYTICS.enabled,
  endpoint: ANALYTICS.endpoint,
  retention: {
    maxAgeDays: ANALYTICS.retention?.max_age_days,
    maxEntries: ANALYTICS.retention?.max_entries,
  },
});

let eventLogger = null;
let cleanupExitTracking = null;

if (isAnalyticsEnabled(analyticsConfig)) {
  // Initialize store and logger
  const eventLogStore = new EventLogStore({
    retention: analyticsConfig.retention,
  });

  eventLogger = new EventLogger({
    store: eventLogStore,
    eventBus,
    getContext: () => {
      const path = controller.runtime?.getCurrentPath?.() ?? null;
      const story = controller.runtime?.story;
      return {
        knot: controller.runtime?.getCurrentKnot?.() ?? null,
        knotPath: path,
        visitCount:
          path && story ? story.state.VisitCountAtPathString(path) : 0,
        day: timeContext.getDay(),
        storyTime: timeContext.format(),
        sessionDuration: timeContext.getSessionDuration(),
      };
    },
    onSessionEnd: isRemoteEnabled(analyticsConfig)
      ? async ({ sessionId, entries }) => {
          await sendBatch(sessionId, entries, analyticsConfig);
        }
      : undefined,
  });

  // Initialize store before logging to ensure IndexedDB persistence
  try {
    await eventLogStore.init();
  } catch (err) {
    console.warn('[Analytics] Failed to initialize store:', err);
  }

  // Start logging events
  eventLogger.start([
    { event: EVENTS.MESSAGE_SENT, type: 'choice' },
    { event: EVENTS.CHAT_OPENED, type: 'navigation' },
    { event: EVENTS.DAY_ADVANCED, type: 'progression' },
  ]);

  // Setup exit tracking for beacon-based delivery
  if (isRemoteEnabled(analyticsConfig)) {
    cleanupExitTracking = setupExitTracking(
      eventLogger,
      controller.runtime,
      analyticsConfig,
    );
  }

  console.log(
    '[Analytics] Enabled',
    isRemoteEnabled(analyticsConfig)
      ? `(endpoint: ${analyticsConfig.endpoint})`
      : '(local only)',
  );
}

// ============================================================
// Unified Back Navigation
// ============================================================

/**
 * Handle back navigation from any view.
 * Priority: drawer → overlays → thread → hub → lock screen
 */
function navigateBack() {
  if (notificationDrawer.isOpen) {
    notificationDrawer.close();
  } else if (!settingsPage.hidden) {
    navigation.pop();
  } else if (!aboutPage.hidden) {
    navigation.pop();
  } else if (!glossaryPage.hidden) {
    navigation.pop();
  } else if (!conversationSettings.hidden) {
    navigation.pop();
  } else if (!playerProfile.hidden) {
    navigation.pop();
  } else if (!thread.hidden) {
    thread.dispatchEvent(new Event('thread-closed', { bubbles: true }));
  } else if (!hub.hidden) {
    document.dispatchEvent(
      new CustomEvent('lockscreen-requested', {
        detail: { notifications: notificationDrawer.notifications },
      }),
    );
  }
  // Lock screen visible → do nothing
}

// Escape key: navigate back
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') navigateBack();
});

// Touch gestures
initGestures(
  {
    appElement: requireElement('#app'),
    contentArea: requireElement('#content-area'),
  },
  {
    onSwipeRight: navigateBack,
    onSwipeDown: () =>
      document.dispatchEvent(new CustomEvent('drawer-open-requested')),
    onSwipeUp: () => notificationDrawer.close(),
    isDrawerOpen: () => notificationDrawer.isOpen,
  },
);

// ============================================================
// Chat Navigation Events
// ============================================================

let _threadFinalize = null;

document.addEventListener('chat-selected', (e) => {
  const { chatId } = e.detail;
  controller.openChat(chatId);
  navigation.push(thread, {
    onComplete: () => {
      _threadFinalize?.();
      _threadFinalize = null;
    },
  });
});

document.addEventListener('thread-closed', () => {
  navigation.pop();
  controller.closeChat();
  controller.saveState();
});

document.addEventListener('notification-clicked', (e) => {
  const { chatId } = e.detail;
  notificationDrawer.remove(chatId);
  controller.openChat(chatId);
  navigation.push(thread, {
    onComplete: () => {
      _threadFinalize?.();
      _threadFinalize = null;
    },
  });
});

// ============================================================
// Overlay Page Navigation
// ============================================================

document.addEventListener('settings-requested', () => {
  navigation.push(settingsPage, { type: 'overlay' });
});

document.addEventListener('about-requested', () => {
  navigation.push(aboutPage, { type: 'overlay' });
});

document.addEventListener('glossary-requested', () => {
  navigation.push(glossaryPage, {
    type: 'overlay',
    onReady: () => glossaryPage.show(),
  });
});

document.addEventListener('glossary-term-clicked', (e) => {
  navigation.push(glossaryPage, {
    type: 'overlay',
    onReady: () => glossaryPage.show(e.detail.termId),
    onComplete: () => glossaryPage.scrollToTerm(e.detail.termId),
  });
});

document.addEventListener('player-profile-requested', () => {
  navigation.push(playerProfile);
});

document.addEventListener('profile-clicked', (e) => {
  const { chatId } = e.detail;
  conversationSettings.chatId = chatId;
  navigation.push(conversationSettings);
});

document.addEventListener('settings-closed', (e) => {
  if (
    e.target === conversationSettings ||
    e.composedPath().includes(conversationSettings)
  ) {
    navigation.pop();
  }
});

document.addEventListener('navigate-back', (e) => {
  const targets = [settingsPage, aboutPage, glossaryPage, playerProfile];
  if (targets.some((t) => e.target === t || e.composedPath().includes(t))) {
    navigation.pop();
  }
});

// ============================================================
// Other Event Handlers
// ============================================================

document.addEventListener('choice-selected', (e) => {
  thread.clearChoices();
  controller.selectChoice(e.detail.index);
});

document.addEventListener('drawer-open-requested', () => {
  notificationDrawer.open();
});

document.addEventListener('theme-toggle-requested', () => {
  themePrefs.toggleTheme();
});

document.addEventListener('game-reset-requested', () => {
  if (eventLogger) {
    eventLogger.newSession();
    timeContext.resetSessionTimer();
  }

  if (cleanupExitTracking) {
    cleanupExitTracking();
    cleanupExitTracking = setupExitTracking(
      eventLogger,
      controller.runtime,
      analyticsConfig,
    );
  }

  controller.resetGame();
});

// ============================================================
// EventBus Subscriptions
// ============================================================

eventBus.on(EVENTS.READY, () => {
  console.log('Game ready');
  const snapshot = controller.actor.getSnapshot();
  const { messageHistory } = snapshot.context;

  // Initialize hub previews and unread states from message history
  for (const [chatId] of Object.entries(CHATS)) {
    const messages = messageHistory[chatId] || [];
    const lastMsg = messages[messages.length - 1];

    if (lastMsg?.text) {
      hub.setPreview(
        chatId,
        lastMsg.text,
        lastMsg.time || '',
        lastMsg.type || 'received',
      );
    }
  }

  // Re-emit notifications for unread chats if drawer is empty (restore case)
  if (notificationDrawer.count === 0) {
    for (const [chatId] of Object.entries(CHATS)) {
      if (!snapshot.context.unreadChatIds?.has(chatId)) continue;
      const msgs = messageHistory[chatId] || [];
      const lastMsg = msgs[msgs.length - 1];
      const preview = lastMsg?.text || '';
      eventBus.emit(
        EVENTS.NOTIFICATION_SHOW,
        createNotificationEvent(chatId, preview),
      );
    }
  }

  // Seed lock screen from drawer
  if (!lockScreen.hidden && notificationDrawer.count > 0) {
    lockScreen.seedNotifications(notificationDrawer.notifications);
  }
});

eventBus.on(EVENTS.CHAT_OPENED, (e) => {
  const { chatId, messages, deferredCount } = e.detail;
  const chat = CHATS[chatId];
  const snapshot = controller.actor.getSnapshot();
  const lastReadId = snapshot.context.lastReadMessageId?.[chatId] || null;
  _threadFinalize = thread.open(
    chatId,
    chat?.title || chatId,
    messages,
    lastReadId,
    deferredCount,
  );
});

// Handle status bar updates from ink tags
controller.addEventListener('status-changed', (e) => {
  const { battery, signal, internet, weather, temperature } = e.detail;

  if (battery !== undefined) {
    batteryContext.setBattery(battery);
  }

  if (signal !== undefined) {
    statusBar.update({ signal });
  }

  if (weather !== undefined || temperature !== undefined) {
    lockScreen.updateWeather(weather, temperature);
  }

  if (internet !== undefined) {
    statusBar.update({ internet });
    if (internet === 'wifi0' || internet === 'mobile0') {
      connectionOverlay.show();
    } else {
      connectionOverlay.hide();
    }
  }
});

controller.addEventListener('error', (e) => {
  console.error('Game error:', e.detail.error);
});

// Auto-save periodically
setInterval(() => {
  controller.saveState();
}, UI.timings.autoSaveInterval);

// Save on page unload
window.addEventListener('beforeunload', () => {
  controller.saveState();
});

// Initialize services
dataService.init();

// Load locale-specific story.json
const storyLocale = i18n.getSavedLocale() || I18N.locale;
controller.init(`./src/dist/${storyLocale}/story.json`);

// Expose for debugging and testing
window.controller = controller;
window.gameHub = hub;
window.gameThread = thread;
window.eventLogger = eventLogger;

// Debug panel (only visible with ?debug query param)
const debugPanel = document.querySelector('debug-panel');
if (debugPanel) {
  debugPanel.setController(controller);
}
