// EventBus - Singleton event emitter for cross-component communication
// Part of vocabulary-agnostic foundation layer

/**
 * Central event bus for decoupled component communication.
 * Components subscribe to events instead of receiving direct method calls.
 *
 * Usage:
 *   import { eventBus } from './foundation/services/event-bus.js';
 *   import { createMessageReceivedEvent } from './event-factories.js';
 *
 *   // Emit using factory (CQO-14 compliant)
 *   eventBus.emit('conv:message-received', createMessageReceivedEvent(chatId, message));
 *
 *   // Subscribe (returns unsubscribe function)
 *   const unsub = eventBus.on('conv:message-received', (e) => {
 *     console.log(e.detail.chatId);
 *   });
 *
 *   // Cleanup
 *   unsub();
 */
export class EventBus {
  constructor() {
    this.target = new EventTarget();
    this.debug = false;
  }

  /**
   * Emit an event to all subscribers
   * @param {string} type - Event type (e.g., 'conv:message-received')
   * @param {Object} detail - Event payload
   */
  emit(type, detail = {}) {
    if (this.debug) {
      console.log(`[EventBus] ${type}`, detail);
    }
    this.target.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * Subscribe to an event
   * @param {string} type - Event type to listen for
   * @param {Function} handler - Event handler (receives CustomEvent)
   * @returns {Function} Unsubscribe function
   */
  on(type, handler) {
    this.target.addEventListener(type, handler);
    return () => this.target.removeEventListener(type, handler);
  }

  /**
   * Unsubscribe from an event
   * @param {string} type - Event type to unsubscribe from
   * @param {Function} handler - The handler to remove
   */
  off(type, handler) {
    this.target.removeEventListener(type, handler);
  }

  /**
   * Subscribe to an event once (auto-removes after first trigger)
   * @param {string} type - Event type to listen for
   * @param {Function} handler - Event handler
   */
  once(type, handler) {
    this.target.addEventListener(type, handler, { once: true });
  }

  /**
   * Enable/disable debug logging
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
  }
}

// Singleton instance
export const eventBus = new EventBus();
