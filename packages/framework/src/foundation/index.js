// Foundation - Public API exports
// Vocabulary-agnostic interactive fiction engine

// Core
export {
  createFoundation,
  createSystemContext,
  Foundation,
} from './core/foundation.js';

// Types (JSDoc typedefs for IDE support)
// Import types.js for @typedef availability: import '../foundation/types.js'
export { InkRuntime } from './core/ink-runtime.js';
// Analytics
export {
  getAnalyticsConfig,
  isAnalyticsEnabled,
  isRemoteEnabled,
} from './services/analytics-config.js';
export {
  sendBatch,
  setupExitTracking,
} from './services/analytics-transport.js';
export { contextRegistry } from './services/context-registry.js';
// Services
export { EventBus, eventBus } from './services/event-bus.js';
// Event factories
export {
  createBatteryChangedEvent,
  createDataErrorEvent,
  createDataRequestEvent,
  createDataResponseEvent,
  createLocaleChangedEvent,
  createLocaleChangingEvent,
  createLocaleReadyEvent,
  createTimeEvent,
} from './services/event-factories.js';
export { EventLogStore } from './services/event-log-store.js';
export { EventLogger } from './services/event-logger.js';
export { createStorageAdapter, storage } from './services/storage-adapter.js';
export {
  TIME_EVENTS,
  TimeContext,
  timeContext,
} from './services/time-context.js';

// State
export {
  appendToHistory,
  commonGuards,
  createDelayActor,
  extractCapturedState,
  generateId,
} from './state/state-factory.js';
