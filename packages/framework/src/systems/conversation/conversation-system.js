// Conversation System - Phone-style messaging UI
// Simple system shape: { id, tagHandlers, createExternalFunctions(), init() }

import { createDataRequestEvent } from '../../foundation/services/event-factories.js';
import { batteryContext } from './services/battery-context.js';
import { tagHandlers } from './tags/index.js';

/**
 * conversationSystem provides phone-style messaging UI:
 * - Multi-chat navigation (hub ↔ thread)
 * - Typing indicators with delay
 * - Push notifications for background messages
 * - Battery simulation (optional phone-specific feature)
 * - Presence indicators (online, offline, last seen)
 *
 * Usage:
 * ```js
 * import { conversationSystem } from './systems/conversation/index.js';
 * import { createSystemContext } from './foundation/index.js';
 *
 * const context = createSystemContext({ foundation, eventBus, timeContext });
 *
 * // Merge handlers with other systems
 * const tagHandlers = [...conversationSystem.tagHandlers];
 * const externalFunctions = conversationSystem.createExternalFunctions(context);
 *
 * // Start foundation with merged handlers
 * await foundation.start(storyUrl, { tagHandlers, externalFunctions });
 *
 * // Initialize system
 * conversationSystem.init(foundation.runtime, eventBus);
 * ```
 *
 * @type {import('../../foundation/types.js').System}
 */
export const conversationSystem = {
  id: 'conversation',

  // Tag handlers (static array)
  tagHandlers,

  /**
   * Create external functions with access to runtime context
   * @param {import('../../foundation/types.js').SystemContext} context
   * @returns {import('../../foundation/types.js').ExternalFunction[]} External function definitions
   */
  createExternalFunctions(context) {
    return [
      // delay_next: Add delay before next message
      // Usage in ink: ~ delay_next(1500)
      {
        name: 'delay_next',
        fn: (ms) => {
          const runtime = context.getRuntime?.();
          if (runtime) {
            runtime.setCapturedDelay(ms);
          }
        },
        lookAheadSafe: false,
      },

      // play_sound: Play a sound effect
      // Usage in ink: ~ play_sound("notification")
      {
        name: 'play_sound',
        fn: (soundId) => {
          // Placeholder - will dispatch event for audio system
          console.log('[conversationSystem] play_sound:', soundId);
        },
        lookAheadSafe: true,
      },

      // advance_day: Move to next day
      // Usage in ink: ~ advance_day()
      {
        name: 'advance_day',
        fn: () => {
          const timeContext = context.getTimeContext?.();
          if (timeContext) {
            timeContext.advanceDay();
          }
        },
        lookAheadSafe: false,
      },

      // name: Get localized name variant
      // Usage in ink: {name("activist", "first_name")}
      {
        name: 'name',
        fn: (id, variant = 'short') => {
          const i18n = context.getI18n?.();
          if (i18n) {
            return i18n.getName(id, variant);
          }
          return id;
        },
        lookAheadSafe: true,
      },

      // request_data: Request external data (async)
      // Usage in ink: ~ request_data("source_name", "query_type", "param")
      {
        name: 'request_data',
        fn: (source, query, params) => {
          const runtime = context.getRuntime?.();
          const eventBus = context.getEventBus?.();

          if (runtime && eventBus) {
            const requestId = `data_${Date.now()}`;
            runtime.awaitingData = true;

            eventBus.emit(
              'data:requested',
              createDataRequestEvent(requestId, source, query, params),
            );
          }
        },
        lookAheadSafe: false,
      },
    ];
  },

  /**
   * Initialize system after foundation is started
   * @param {InkRuntime} runtime - Ink runtime instance
   * @param {EventBus} eventBus - Event bus for cross-component communication
   * @param {Object} [options]
   * @param {Object} [options.batteryConfig] - Battery configuration
   */
  init(runtime, eventBus, options = {}) {
    console.log('[conversationSystem] Initializing');

    // Configure battery context if provided
    if (options.batteryConfig) {
      batteryContext.configure(options.batteryConfig);
    }

    // Connect battery to time context for automatic drain
    batteryContext.connectToTimeContext();

    console.log('[conversationSystem] Ready');
  },
};
