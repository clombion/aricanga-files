// Foundation Services - Public API exports

// Analytics
export {
  getAnalyticsConfig,
  isAnalyticsEnabled,
  isRemoteEnabled,
} from './analytics-config.js';
export {
  sendBatch,
  sendBeaconExit,
  setupExitTracking,
} from './analytics-transport.js';
export { CommunityService } from './community-service.js';
export { contextRegistry } from './context-registry.js';
export { EventBus, eventBus } from './event-bus.js';
export {
  createBatteryChangedEvent,
  createDataRequestEvent,
  createTimeEvent,
  required,
} from './event-factories.js';
export { EventLogStore } from './event-log-store.js';
export { EventLogger } from './event-logger.js';
export { createStorageAdapter, storage } from './storage-adapter.js';
export { TIME_EVENTS, TimeContext, timeContext } from './time-context.js';
