// Single event bus for cross-cutting sinks only — analytics and cross-system
// coordination (the host feeds it through `emit`). Rendering does NOT depend
// on the bus; a view-model derives purely from state.

export interface DomainEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}

export type Unsubscribe = () => void;

export interface EventBus {
  emit(event: DomainEvent): void;
  on(type: string, handler: (event: DomainEvent) => void): Unsubscribe;
}

export function createEventBus(): EventBus {
  const handlers = new Map<string, Set<(event: DomainEvent) => void>>();
  return {
    emit(event) {
      const set = handlers.get(event.type);
      if (set === undefined) return;
      // A snapshot: a handler may unsubscribe while the event is being delivered.
      for (const handler of Array.from(set)) handler(event);
    },
    on(type, handler) {
      let set = handlers.get(type);
      if (set === undefined) {
        set = new Set();
        handlers.set(type, set);
      }
      set.add(handler);
      return () => {
        handlers.get(type)?.delete(handler);
      };
    },
  };
}
