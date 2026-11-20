/*
 * Single event bus for cross-cutting sinks only — analytics and cross-system
 * coordination (the host feeds it through `emit`). Rendering does NOT depend
 * on the bus; a view-model derives purely from state.
 */

/** A cross-cutting event: its type and whatever fields the emitter attaches. */
interface DomainEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}

/** @public */
type Unsubscribe = () => void;

/** A handler the bus calls with each event of the type it subscribed to. */
type Handler = (event: DomainEvent) => void;

/** @public */
interface EventBus {
  readonly emit: (event: DomainEvent) => void;
  readonly on: (type: string, handler: Handler) => Unsubscribe;
}

/**
 * A bus that delivers each emitted event to the handlers subscribed to its type.
 *
 * @returns {EventBus} A new, empty bus.
 */
function createEventBus(): EventBus {
  const handlers = new Map<string, Set<Handler>>();
  return {
    emit: (event) => {
      const subscribed = handlers.get(event.type);
      if (subscribed === undefined) {
        return;
      }
      // A snapshot: a handler may unsubscribe while the event is being delivered.
      for (const handler of new Set(subscribed)) {
        handler(event);
      }
    },
    on: (type, handler) => {
      const subscribed = handlers.get(type) ?? new Set<Handler>();
      subscribed.add(handler);
      handlers.set(type, subscribed);
      return () => {
        subscribed.delete(handler);
      };
    },
  };
}

export { createEventBus };
export type { DomainEvent, EventBus, Unsubscribe };
