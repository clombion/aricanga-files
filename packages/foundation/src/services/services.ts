import type { DomainEvent } from './event-bus';

// Instance-scoped services injected at the composition root (no module singletons).
// `SaveStore` is named to avoid shadowing the DOM `Storage` global.

export interface Clock {
  now(): number;
}

export interface SaveStore {
  load(): string | null;
  save(data: string): void;
}

export interface AnalyticsSink {
  record(event: DomainEvent): void;
}
