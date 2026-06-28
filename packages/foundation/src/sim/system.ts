import type { KernelStatus, ReduceContext, ReduceResult, RenderContext } from './context';
import type { Effect } from './effect';
import type { Command, Input } from './input';
import type { SystemId } from './snapshot';

// The contract every system implements so foundation stays vocabulary-agnostic
// (ADR-0007). A system is a pure pair of functions plus identity. `Input` is
// derived from the system's `Command` so the generic runtime can construct every
// inbound value; `Effect` is the system's closed specialisation of the families.
// References only foundation types — never a chat- or card-specific type.
export interface System<
  TState,
  TCommand extends Command,
  TEffect extends Effect,
  TViewModel,
> {
  readonly id: string;
  /** Ink tag keys this system claims — the single source of truth for routing. */
  readonly tags: readonly string[];
  /** Deterministic initial state. */
  init(seed: number): TState;
  reduce(
    state: TState,
    input: Input<TState, TCommand>,
    ctx: ReduceContext,
  ): ReduceResult<TState, TEffect>;
  /** Pure: what the system is waiting for. */
  status(state: TState): KernelStatus;
  view(state: TState, render: RenderContext): TViewModel;
}

// State-erased view of a system for the runtime registry. A concrete
// `System<…>` can't be stored as `System<unknown, …>` (reduce is contravariant
// in state), so the registry holds this erased shape; the only cast in the
// framework is at registration, where the concrete generics are known.
export interface AnySystem {
  readonly id: SystemId;
  readonly tags: readonly string[];
  init(seed: number): unknown;
  reduce(
    state: unknown,
    input: Input<unknown, Command>,
    ctx: ReduceContext,
  ): ReduceResult<unknown, Effect>;
  status(state: unknown): KernelStatus;
  view(state: unknown, render: RenderContext): unknown;
}

/** Erase a concrete system's generics for storage in the runtime registry. */
export function erase<TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
  system: System<TState, TCommand, TEffect, TViewModel>,
): AnySystem {
  return system as unknown as AnySystem;
}
