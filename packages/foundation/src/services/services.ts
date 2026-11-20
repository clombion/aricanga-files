import type { DomainEvent } from './event-bus';

// Instance-scoped services injected at the composition root (no module singletons).
// `SaveStore` is named to avoid shadowing the DOM `Storage` global.

/** @public */
export interface Clock {
  now(): number;
}

export interface SaveStore {
  load(): string | null;
  save(data: string): void;
}

/** @public */
export interface AnalyticsSink {
  record(event: DomainEvent): void;
}

// Injected timer source (no `setTimeout` in the kernel). `schedule` returns a
// cancel handle. A real host backs this with `setTimeout`; tests use a fake that
// fires on demand, keeping the runtime deterministic.
export interface Scheduler {
  schedule(delayMs: number, fire: () => void): () => void;
}
