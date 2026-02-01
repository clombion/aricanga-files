// Event logger - Subscribes to EventBus, transforms and persists events

/**
 * EventLogger - Bridges EventBus events to EventLogStore
 *
 * Features:
 * - Subscribes to configurable event types
 * - Adds context (session, timestamp) to each entry
 * - Optional hooks for real-time streaming or batch export
 */
export class EventLogger {
  #store;
  #eventBus;
  #getContext;
  #onEvent;
  #onSessionEnd;
  #sessionId;
  #subscriptions = [];
  #sessionEntries = [];

  /**
   * @param {Object} options
   * @param {EventLogStore} options.store - Storage backend
   * @param {EventBus} [options.eventBus] - EventBus for auto-subscription (optional)
   * @param {Function} [options.getContext] - Returns context object to attach to entries
   * @param {Array<{event: string, type: string}>} [options.eventTypes] - Events to auto-subscribe
   * @param {Function} [options.onEvent] - Called on each logged event (for real-time streaming)
   * @param {Function} [options.onSessionEnd] - Called with session entries on session end
   */
  constructor(options = {}) {
    this.#store = options.store;
    this.#eventBus = options.eventBus;
    this.#getContext = options.getContext || (() => ({}));
    this.#onEvent = options.onEvent;
    this.#onSessionEnd = options.onSessionEnd;
    this.#sessionId = this.#generateSessionId();
  }

  /**
   * Start logging - subscribes to EventBus events
   * @param {Array<{event: string, type: string}>} [eventTypes] - Override configured events
   * @returns {Function} Cleanup function to stop logging
   */
  start(eventTypes = []) {
    if (!this.#eventBus) {
      console.warn('EventLogger: No eventBus provided, manual logging only');
      return () => {};
    }

    for (const { event, type } of eventTypes) {
      const handler = (e) => {
        this.log(type, e.detail || {});
      };

      this.#eventBus.on(event, handler);
      this.#subscriptions.push({ event, handler });
    }

    return () => this.stop();
  }

  /**
   * Stop logging - unsubscribes from EventBus
   */
  stop() {
    for (const { event, handler } of this.#subscriptions) {
      this.#eventBus?.off(event, handler);
    }
    this.#subscriptions = [];
  }

  /**
   * Log an event manually
   * @param {string} type - Event type (e.g., 'choice', 'navigation')
   * @param {Object} payload - Event-specific data
   * @returns {Promise<void>}
   */
  async log(type, payload) {
    const entry = {
      id: this.#generateId(),
      type,
      timestamp: Date.now(),
      sessionId: this.#sessionId,
      payload,
      context: this.#getContext(),
    };

    // Store locally
    if (this.#store) {
      try {
        await this.#store.add(entry);
      } catch (err) {
        console.warn('EventLogger: Failed to store entry', err);
      }
    }

    // Track for session batch
    this.#sessionEntries.push(entry);

    // Real-time hook
    if (this.#onEvent) {
      try {
        await this.#onEvent(entry);
      } catch (err) {
        console.warn('EventLogger: onEvent hook failed', err);
      }
    }
  }

  /**
   * Get current session ID
   * @returns {string}
   */
  getSessionId() {
    return this.#sessionId;
  }

  /**
   * Start a new session (call on game reset)
   * Triggers onSessionEnd if configured
   * @returns {Promise<void>}
   */
  async newSession() {
    // Call session end hook with previous session's entries
    if (this.#onSessionEnd && this.#sessionEntries.length > 0) {
      try {
        await this.#onSessionEnd({
          sessionId: this.#sessionId,
          entries: this.#sessionEntries,
        });
      } catch (err) {
        console.warn('EventLogger: onSessionEnd hook failed', err);
      }
    }

    // Reset for new session
    this.#sessionId = this.#generateSessionId();
    this.#sessionEntries = [];
  }

  /**
   * Get entries from current session (from memory, not store)
   * @returns {Array}
   */
  getSessionEntries() {
    return [...this.#sessionEntries];
  }

  /**
   * Get the underlying store for direct access
   * @returns {EventLogStore}
   */
  getStore() {
    return this.#store;
  }

  #generateId() {
    return crypto.randomUUID();
  }

  #generateSessionId() {
    return `session-${crypto.randomUUID().slice(0, 8)}`;
  }
}
