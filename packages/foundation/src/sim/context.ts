import type { Effect } from './effect';

/*
 * What a system is waiting for — a pure predicate over state (ADR-0007). The
 * runtime combines this with host-owned ink readiness to decide the next step.
 */
type KernelStatus = 'free' | 'busy-commit' | 'busy-data';

/*
 * Deterministic context for `reduce` — a seeded id source only. No clock, no
 * randomness. The id allocator is host/runtime-owned (it persists its position
 * as `idSeq`); this is its per-reduce handle, so `reduce` stays referentially
 * transparent given `(state, input, ctx)`.
 */
interface ReduceContext {
  readonly nextId: () => string;
}

/** Render-time context for `view` — host-injected, never frozen into state. */
interface RenderContext {
  readonly now: number;
  readonly locale: string;
}

/** What one reduction returns: the next state and the effects it asks the host for. */
interface ReduceResult<TState, TEffect extends Effect = Effect> {
  readonly state: TState;
  readonly effects: readonly TEffect[];
}

export type { KernelStatus, ReduceContext, ReduceResult, RenderContext };
