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
    input: Input<unknown>,
    ctx: ReduceContext,
  ): ReduceResult<unknown>;
  status(state: unknown): KernelStatus;
  view(state: unknown, render: RenderContext): unknown;
}

/** Erase a concrete system's generics for storage in the runtime registry. */
export function erase<TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
  system: System<TState, TCommand, TEffect, TViewModel>,
): AnySystem {
  return system;
}

/** A value the runtime registry holds for one system: its state or its view, with the owner's id. */
export interface Owned {
  readonly systemId: SystemId;
  readonly value: unknown;
}

/**
 * Read back a value the erased registry holds, typed by the system that produced it: the one place a
 * system's state or view regains its type. The registry stores each system's values under its id and
 * hands them only to that system, so a matching id is the proof; a mismatch throws.
 */
function reclaim(system: { readonly id: SystemId }, owned: Owned): unknown {
  if (owned.systemId !== system.id) {
    throw new Error(`a value of system "${owned.systemId}" was read back as system "${system.id}"`);
  }
  return owned.value;
}

/** A system's state, read back from the registry or a trace record. */
export function stateOf<TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
  system: System<TState, TCommand, TEffect, TViewModel>,
  owned: Owned,
): TState {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- reclaim proved the ids match, so the state is this system's own
  return reclaim(system, owned) as TState;
}

/** A system's view-model, read back from the registry. */
export function viewOf<TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
  system: System<TState, TCommand, TEffect, TViewModel>,
  owned: Owned,
): TViewModel {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- reclaim proved the ids match, so the view is this system's own
  return reclaim(system, owned) as TViewModel;
}
