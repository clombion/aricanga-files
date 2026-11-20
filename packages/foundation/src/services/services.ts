import type { DomainEvent } from './event-bus';

/*
 * Instance-scoped services injected at the composition root (no module singletons).
 * `SaveStore` is named to avoid shadowing the DOM `Storage` global.
 */

/** @public */
interface Clock {
  readonly now: () => number;
}

/** The host's save slot: the text it last saved, or `undefined` when nothing is saved. */
interface SaveStore {
  readonly load: () => string | undefined;
  readonly save: (data: string) => void;
}

/** @public */
interface AnalyticsSink {
  readonly record: (event: DomainEvent) => void;
}

/*
 * Injected timer source (no `setTimeout` in the kernel). `schedule` returns a
 * cancel handle. A real host backs this with `setTimeout`; tests use a fake that
 * fires on demand, keeping the runtime deterministic.
 */
interface Scheduler {
  readonly schedule: (delayMs: number, fire: () => void) => () => void;
}

export type { AnalyticsSink, Clock, SaveStore, Scheduler };
