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
  transitionViews,
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

/**
 * Wrapper for transitionViews that applies current motion preference.
 * Serializes transitions so a new one waits for the previous to finish,
 * preventing concurrent animations from corrupting element state.
 */
let transitionQueue = Promise.resolve();
function transition(outgoing, incoming, options = {}) {
  const run = () =>
    transitionViews(outgoing, incoming, {
      ...options,
      motionLevel: motionPrefs.getEffectiveLevel(),
    });
  transitionQueue = transitionQueue.then(run, run);
  return transitionQueue;
}

const controller = new GameController();

// Component references
// Why: Components self-subscribe to EventBus in connectedCallback - no manual wiring needed here
const lockScreen = document.querySelector('lock-screen');
const hub = document.querySelector('chat-hub');
const thread = document.querySelector('chat-thread');
const conversationSettings = document.querySelector('conversation-settings');
const notificationDrawer = document.querySelector('notification-drawer');
const statusBar = document.querySelector('phone-status-bar');
const connectionOverlay = document.querySelector('connection-overlay');
const settingsPage = document.querySelector('settings-page');
const aboutPage = document.querySelector('about-page');
const glossaryPage = document.querySelector('glossary-page');
const playerProfile = document.querySelector('player-profile');

// Hide main UI until lock screen is dismissed
hub.hidden = true;
statusBar.hidden = true;

// Create transition overlay for fade effect during overlay page transitions
const transitionOverlay = document.createElement('div');
transitionOverlay.className = 'ink-transition-overlay';
transitionOverlay.hidden = true;
document.querySelector('#content-area').appendChild(transitionOverlay);

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

// Lock screen unlock handler
document.addEventListener('lock-screen-unlocked', () => {
  lockScreen.stopAnimation();
  statusBar.hidden = false;
  transition(lockScreen, hub, { direction: 'slide-up', duration: 400 });
});

// Return to lock screen (for testing)
document.addEventListener('lockscreen-requested', (e) => {
  transition(hub, lockScreen, { direction: 'slide-down' });
  statusBar.hidden = true;
  lockScreen.show(e.detail.notifications);
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

  // Initialize store (async, but don't block)
  eventLogStore.init().catch((err) => {
    console.warn('[Analytics] Failed to initialize store:', err);
  });

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

// Escape key: navigate back to parent view
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  // Check overlays/modals first (highest z-order), then deeper views
  if (notificationDrawer.isOpen) {
    notificationDrawer.close();
  } else if (!settingsPage.hidden) {
    settingsPage.dispatchEvent(new Event('navigate-back', { bubbles: true }));
  } else if (!aboutPage.hidden) {
    aboutPage.dispatchEvent(new Event('navigate-back', { bubbles: true }));
  } else if (!glossaryPage.hidden) {
    glossaryPage.dispatchEvent(new Event('navigate-back', { bubbles: true }));
  } else if (!conversationSettings.hidden) {
    conversationSettings.dispatchEvent(
      new Event('settings-closed', { bubbles: true }),
    );
  } else if (!playerProfile.hidden) {
    playerProfile.dispatchEvent(new Event('navigate-back', { bubbles: true }));
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
});

// Touch gestures: swipe-down (open drawer), swipe-up (close drawer), swipe-right (back)
{
  const appEl = document.querySelector('#app');
  const contentArea = document.querySelector('#content-area');
  let touchStartX = null;
  let touchStartY = null;

  appEl.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true },
  );

  appEl.addEventListener(
    'touchend',
    (e) => {
      if (touchStartX === null || touchStartY === null) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - touchStartX;
      const deltaY = endY - touchStartY;
      const absDX = Math.abs(deltaX);
      const absDY = Math.abs(deltaY);
      touchStartX = null;
      touchStartY = null;

      // Swipe-up anywhere: close notification drawer
      if (notificationDrawer.isOpen && deltaY < -50 && absDY > absDX) {
        notificationDrawer.close();
        return;
      }

      // Swipe-down from top half: open notification drawer
      const contentRect = contentArea.getBoundingClientRect();
      const contentMidY = contentRect.top + contentRect.height / 2;
      if (
        !notificationDrawer.isOpen &&
        deltaY > 40 &&
        absDY > absDX &&
        e.changedTouches[0].clientY - deltaY < contentMidY
      ) {
        document.dispatchEvent(new CustomEvent('drawer-open-requested'));
        return;
      }

      // Swipe-right from left half: back-navigate (same as ESC)
      const appRect = appEl.getBoundingClientRect();
      const appMidX = appRect.left + appRect.width / 2;
      if (
        deltaX > 60 &&
        absDX > absDY &&
        endX - deltaX < appMidX &&
        !notificationDrawer.isOpen
      ) {
        if (!settingsPage.hidden) {
          settingsPage.dispatchEvent(
            new Event('navigate-back', { bubbles: true }),
          );
        } else if (!aboutPage.hidden) {
          aboutPage.dispatchEvent(
            new Event('navigate-back', { bubbles: true }),
          );
        } else if (!glossaryPage.hidden) {
          glossaryPage.dispatchEvent(
            new Event('navigate-back', { bubbles: true }),
          );
        } else if (!conversationSettings.hidden) {
          conversationSettings.dispatchEvent(
            new Event('settings-closed', { bubbles: true }),
          );
        } else if (!playerProfile.hidden) {
          playerProfile.dispatchEvent(
            new Event('navigate-back', { bubbles: true }),
          );
        } else if (!thread.hidden) {
          thread.dispatchEvent(new Event('thread-closed', { bubbles: true }));
        } else if (!hub.hidden) {
          document.dispatchEvent(
            new CustomEvent('lockscreen-requested', {
              detail: { notifications: notificationDrawer.notifications },
            }),
          );
        }
      }
    },
    { passive: true },
  );
}

// Wire up events from components
document.addEventListener('chat-selected', (e) => {
  const { chatId } = e.detail;
  controller.openChat(chatId);
  transition(hub, thread, TRANSITIONS.ENTER_DEEPER).then(() => {
    _threadFinalize?.();
    _threadFinalize = null;
  });
});

document.addEventListener('thread-closed', () => {
  transition(thread, hub, TRANSITIONS.GO_BACK);
  controller.closeChat();
  controller.saveState();
});

document.addEventListener('choice-selected', (e) => {
  thread.clearChoices();
  controller.selectChoice(e.detail.index);
});

document.addEventListener('notification-clicked', (e) => {
  const { chatId } = e.detail;
  // Remove from drawer when user opens the chat via notification
  notificationDrawer.remove(chatId);
  controller.openChat(chatId);
  transition(hub, thread, TRANSITIONS.ENTER_DEEPER).then(() => {
    _threadFinalize?.();
    _threadFinalize = null;
  });
});

document.addEventListener('drawer-open-requested', () => {
  notificationDrawer.open();
});

// Theme toggle from notification drawer
document.addEventListener('theme-toggle-requested', () => {
  themePrefs.toggleTheme();
});

// NEW: Listen for the reset request from ChatHub
document.addEventListener('game-reset-requested', () => {
  // End current analytics session before reset
  if (eventLogger) {
    eventLogger.newSession();
    timeContext.resetSessionTimer();
  }

  // Clean up old exit tracking (has stale exitSent flag) and re-setup
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

// Settings page navigation
let wasInChatBeforeSettings = false;

document.addEventListener('settings-requested', () => {
  wasInChatBeforeSettings = !thread.hidden;
  const outgoing = wasInChatBeforeSettings ? thread : hub;
  transition(outgoing, settingsPage, {
    ...TRANSITIONS.OPEN_OVERLAY,
    overlay: transitionOverlay,
  });
});

document.addEventListener('navigate-back', (e) => {
  const returnTo = wasInChatBeforeSettings ? thread : hub;
  // Settings page back navigation
  if (e.target === settingsPage || e.composedPath().includes(settingsPage)) {
    transition(settingsPage, returnTo, TRANSITIONS.CLOSE_OVERLAY);
  }
  // About page back navigation
  if (e.target === aboutPage || e.composedPath().includes(aboutPage)) {
    transition(aboutPage, returnTo, TRANSITIONS.CLOSE_OVERLAY);
  }
  // Glossary page back navigation
  if (e.target === glossaryPage || e.composedPath().includes(glossaryPage)) {
    transition(glossaryPage, returnTo, TRANSITIONS.CLOSE_OVERLAY);
  }
});

// About page navigation
document.addEventListener('about-requested', () => {
  wasInChatBeforeSettings = !thread.hidden;
  const outgoing = wasInChatBeforeSettings ? thread : hub;
  transition(outgoing, aboutPage, {
    ...TRANSITIONS.OPEN_OVERLAY,
    overlay: transitionOverlay,
  });
});

// Glossary page navigation (from drawer tile)
document.addEventListener('glossary-requested', () => {
  wasInChatBeforeSettings = !thread.hidden;
  const outgoing = wasInChatBeforeSettings ? thread : hub;
  glossaryPage.show();
  transition(outgoing, glossaryPage, {
    ...TRANSITIONS.OPEN_OVERLAY,
    overlay: transitionOverlay,
  });
});

// Glossary term clicked (from chat thread highlights)
document.addEventListener('glossary-term-clicked', (e) => {
  wasInChatBeforeSettings = !thread.hidden;
  const outgoing = wasInChatBeforeSettings ? thread : hub;
  glossaryPage.show(e.detail.termId);
  transition(outgoing, glossaryPage, {
    ...TRANSITIONS.OPEN_OVERLAY,
    overlay: transitionOverlay,
  });
});

// Player profile page navigation (hub avatar click)
document.addEventListener('player-profile-requested', () => {
  transition(hub, playerProfile, TRANSITIONS.ENTER_DEEPER);
});

document.addEventListener('navigate-back', (e) => {
  if (e.target === playerProfile || e.composedPath().includes(playerProfile)) {
    transition(playerProfile, hub, TRANSITIONS.GO_BACK);
  }
});

// Conversation settings page navigation (per-chat settings via avatar click)
document.addEventListener('profile-clicked', (e) => {
  const { chatId } = e.detail;
  conversationSettings.chatId = chatId;
  transition(thread, conversationSettings, TRANSITIONS.ENTER_DEEPER);
});

document.addEventListener('settings-closed', (e) => {
  if (
    e.target === conversationSettings ||
    e.composedPath().includes(conversationSettings)
  ) {
    transition(conversationSettings, thread, TRANSITIONS.GO_BACK);
  }
});

// Wire up events from EventBus (migrated from controller events)
eventBus.on(EVENTS.READY, () => {
  console.log('Game ready');
  const snapshot = controller.actor.getSnapshot();
  const { messageHistory } = snapshot.context;
  // Initialize hub previews and unread states from message history
  for (const [chatId] of Object.entries(CHATS)) {
    const messages = messageHistory[chatId] || [];
    const lastMsg = messages[messages.length - 1];

    // Set hub preview from last message (seeds or saved history)
    // CSS handles text truncation via -webkit-line-clamp
    if (lastMsg?.text) {
      hub.setPreview(
        chatId,
        lastMsg.text,
        lastMsg.time || '',
        lastMsg.type || 'received',
      );
    }

    // Unread badges are restored via NOTIFICATION_SHOW re-emit below
    // (hub subscribes to NOTIFICATION_SHOW directly)
  }

  // Re-emit notifications for unread chats if drawer is empty (restore case).
  // On fresh start, ink already fires NOTIFICATION_SHOW so drawer is populated.
  if (notificationDrawer.count === 0) {
    for (const [chatId] of Object.entries(CHATS)) {
      if (!controller._unreadState?.[chatId]) continue;
      const msgs = messageHistory[chatId] || [];
      const lastMsg = msgs[msgs.length - 1];
      const preview = lastMsg?.text || '';
      eventBus.emit(
        EVENTS.NOTIFICATION_SHOW,
        createNotificationEvent(chatId, preview),
      );
    }
  }

  // Seed lock screen from drawer (now repopulated above)
  if (!lockScreen.hidden && notificationDrawer.count > 0) {
    lockScreen.seedNotifications(notificationDrawer.notifications);
  }
});

// open() returns a finalize function (deferred scroll) that must run
// after the view transition completes — see chat-selected/notification-clicked.
let _threadFinalize = null;

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

// Handle status bar updates from ink tags (battery, signal, internet)
// Why: Battery goes through BatteryContext (SSOT); signal/internet update statusBar directly
// Connection overlay is emergent — derived from internet wifi0/mobile0
controller.addEventListener('status-changed', (e) => {
  const { battery, signal, internet, weather, temperature } = e.detail;

  // Battery override (for story events like "phone charging")
  // Goes through BatteryContext to maintain single source of truth
  if (battery !== undefined) {
    batteryContext.setBattery(battery);
  }

  // Signal updates (cellular bars only — no overlay trigger)
  if (signal !== undefined) {
    statusBar.update({ signal });
  }

  // Weather/temperature updates (lock screen only — status bar doesn't show weather)
  if (weather !== undefined || temperature !== undefined) {
    lockScreen.updateWeather(weather, temperature);
  }

  // Internet connectivity updates + emergent connection overlay
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
// Use saved locale preference from localStorage, or fall back to default
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
