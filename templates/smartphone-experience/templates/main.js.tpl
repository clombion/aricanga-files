// {{title}} - Main entry point
// Wire up controller and components for the smartphone chat experience

// Framework imports
import {
  contextRegistry,
  eventBus,
  timeContext,
  getAnalyticsConfig,
  isAnalyticsEnabled,
  isRemoteEnabled,
  sendBatch,
  setupExitTracking,
  EventLogger,
  EventLogStore,
  EVENTS,
  batteryContext,
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
  ui: UI,
});

// Implementation-specific components
import './components/settings-page.js';
import './components/debug-panel.js';

// Wait for i18n to be ready before initializing
await i18nReady;

const controller = new GameController();

/** @returns {Element} the matched element, or throws if missing */
function requireElement(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Required element missing: <${selector}>`);
  return el;
}

// Component references
const hub = requireElement('chat-hub');
const thread = requireElement('chat-thread');
const notificationDrawer = requireElement('notification-drawer');
const statusBar = requireElement('phone-status-bar');
const connectionOverlay = requireElement('connection-overlay');
const settingsPage = requireElement('settings-page');

// Configure BatteryContext with phone behavior settings
batteryContext.configure({
  startBattery: START_STATE.battery,
  drainPerHour: PHONE.behavior.battery_drain_per_hour,
  lowBatteryThreshold: PHONE.behavior.low_battery_warning,
});
batteryContext.connectToTimeContext();

// ============================================================
// Analytics Setup
// ============================================================

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

  eventLogger.start([
    { event: EVENTS.MESSAGE_SENT, type: 'choice' },
    { event: EVENTS.CHAT_OPENED, type: 'navigation' },
    { event: EVENTS.DAY_ADVANCED, type: 'progression' },
  ]);

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
// Event Wiring
// ============================================================

document.addEventListener('chat-selected', (e) => {
  const { chatId } = e.detail;
  hub.hidden = true;
  controller.openChat(chatId);
});

document.addEventListener('thread-closed', () => {
  hub.hidden = false;
  thread.hidden = true;
  controller.closeChat();
  controller.saveState();
});

document.addEventListener('choice-selected', (e) => {
  thread.clearChoices();
  controller.selectChoice(e.detail.index);
});

document.addEventListener('notification-clicked', (e) => {
  hub.hidden = true;
  controller.openChat(e.detail.chatId);
});

eventBus.on(EVENTS.NOTIFICATION_SHOW, () => {
  statusBar.setPopupVisible(true);
});

document.addEventListener('notification-auto-hidden', (e) => {
  statusBar.setPopupVisible(false);
  notificationDrawer.add(e.detail);
});

document.addEventListener(
  'notification-clicked',
  () => {
    statusBar.setPopupVisible(false);
  },
  true,
);

document.addEventListener('notification-dismissed', () => {
  statusBar.setPopupVisible(false);
});

document.addEventListener('drawer-count-changed', (e) => {
  statusBar.updateDrawerCount(e.detail.count);
});

document.addEventListener('drawer-open-requested', () => {
  notificationDrawer.open();
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

// Settings page navigation
let wasInChatBeforeSettings = false;

document.addEventListener('settings-requested', () => {
  wasInChatBeforeSettings = !thread.hidden;
  hub.hidden = true;
  thread.hidden = true;
  settingsPage.hidden = false;
});

document.addEventListener('navigate-back', (e) => {
  if (e.target === settingsPage || e.composedPath().includes(settingsPage)) {
    settingsPage.hidden = true;
    if (wasInChatBeforeSettings) {
      thread.hidden = false;
    } else {
      hub.hidden = false;
    }
  }
});

// EventBus events
eventBus.on(EVENTS.READY, () => {
  console.log('Game ready');
  for (const chatId of Object.keys(CHATS)) {
    if (controller._unreadState?.[chatId]) {
      hub.setUnread(chatId, true);
    }
  }
});

eventBus.on(EVENTS.CHAT_OPENED, (e) => {
  const { chatId, messages } = e.detail;
  const chat = CHATS[chatId];
  thread.open(chatId, chat?.title || chatId, messages);
});

eventBus.on(EVENTS.BATTERY_CHANGED, (e) => {
  const { battery } = e.detail;
  statusBar.update({ battery });
});

controller.addEventListener('status-changed', (e) => {
  const { battery, signal, connectionUnstable } = e.detail;

  if (battery !== undefined) {
    batteryContext.setBattery(battery);
  }

  if (signal !== undefined) {
    statusBar.update({ signal });
  }

  if (connectionUnstable !== undefined) {
    statusBar.update({ connectionUnstable });
    if (connectionUnstable) {
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

// Expose for debugging
window.controller = controller;
window.gameHub = hub;
window.gameThread = thread;
window.eventLogger = eventLogger;

// Debug panel (only visible with ?debug query param)
const debugPanel = document.querySelector('debug-panel');
if (debugPanel) {
  debugPanel.setController(controller);
}
