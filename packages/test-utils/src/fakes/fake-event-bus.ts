/**
 * FakeEventBus - Test double for EventBus
 *
 * Implements the same interface as src/foundation/services/event-bus.js
 * but stores emitted events for test assertions.
 */
export class FakeEventBus {
  private listeners = new Map<string, Array<(event: { detail: unknown }) => void>>();
  public emittedEvents: Array<{ type: string; detail: unknown }> = [];

  /**
   * Emit an event to all subscribers
   */
  emit(type: string, detail: unknown = {}): void {
    this.emittedEvents.push({ type, detail });
    const handlers = this.listeners.get(type);
    if (handlers) {
      const event = { detail };
      handlers.forEach((handler) => handler(event));
    }
  }

  /**
   * Subscribe to an event
   * @returns Unsubscribe function
   */
  on(type: string, handler: (event: { detail: unknown }) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(handler);
    return () => {
      const handlers = this.listeners.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to an event once
   */
  once(type: string, handler: (event: { detail: unknown }) => void): void {
    const wrappedHandler = (event: { detail: unknown }) => {
      this.listeners.get(type)?.splice(
        this.listeners.get(type)!.indexOf(wrappedHandler),
        1
      );
      handler(event);
    };
    this.on(type, wrappedHandler);
  }

  /**
   * Helper: Get all events of a specific type
   */
  getEventsOfType(type: string): Array<{ type: string; detail: unknown }> {
    return this.emittedEvents.filter((e) => e.type === type);
  }

  /**
   * Helper: Clear recorded events (useful between tests)
   */
  clear(): void {
    this.emittedEvents = [];
    this.listeners.clear();
  }
}
