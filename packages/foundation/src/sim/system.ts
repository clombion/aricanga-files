import type { Command, Input, Resume } from './input';
import type { KernelStatus, ReduceContext, ReduceResult, RenderContext } from './context';
import type { Effect } from './effect';
import type { SystemId } from './snapshot';
import { assertNever } from './exhaustive';

/*
 * The contract every system implements so foundation stays vocabulary-agnostic
 * (ADR-0007). A system is a pure pair of functions plus identity. `Input` is
 * derived from the system's `Command` so the generic runtime can construct every
 * inbound value; `Effect` is the system's closed specialisation of the families.
 * References only foundation types — never a chat- or card-specific type.
 */
interface System<TState, TCommand extends Command, TEffect extends Effect, TViewModel> {
  readonly id: string;
  /** Ink tag keys this system claims — the single source of truth for routing. */
  readonly tags: readonly string[];
  /** Deterministic initial state. */
  readonly init: (seed: number) => TState;
  readonly reduce: (state: TState, input: Input<TState, TCommand>, ctx: ReduceContext) => ReduceResult<TState, TEffect>;
  /** Pure: what the system is waiting for. */
  readonly status: (state: TState) => KernelStatus;
  readonly view: (state: TState, render: RenderContext) => TViewModel;
  /**
   * Parse an inbound player command: one of this system's own commands, or refused with an
   * `InputRefusedError` naming the value and the system. The one way a command reaches `reduce`.
   */
  readonly parseCommand: (value: unknown) => TCommand;
  /**
   * Parse a state read back from a save or a `restored` resume: this system's state, or refused
   * with an `InputRefusedError`. The one way a state from outside reaches the registry.
   */
  readonly parseState: (value: unknown) => TState;
}

/*
 * State-erased view of a system for the runtime registry. A concrete
 * `System<…>` can't be stored as `System<unknown, …>` (reduce is contravariant
 * in state and command), so the registry holds this erased shape, built by
 * `erase` from closures over the concrete system: a command or a restored state
 * from outside is parsed by the system itself, and a state the registry holds
 * goes back to its system through the owner proof of `stateOf`.
 */
interface AnySystem {
  readonly id: SystemId;
  readonly tags: readonly string[];
  readonly init: (seed: number) => unknown;
  readonly reduce: (state: unknown, input: Input<unknown>, ctx: ReduceContext) => ReduceResult<unknown>;
  readonly status: (state: unknown) => KernelStatus;
  readonly view: (state: unknown, render: RenderContext) => unknown;
  readonly parseState: (value: unknown) => unknown;
}

/**
 * A value the runtime registry holds for one system: its state or its view, with the owner's id.
 *
 * @public
 */
interface Owned {
  readonly systemId: SystemId;
  readonly value: unknown;
}

/**
 * Read back a value the erased registry holds, typed by the system that produced it: the one place a
 * system's state or view regains its type. The registry stores each system's values under its id and
 * hands them only to that system, so a matching id is the proof; a mismatch throws.
 *
 * @param {string} systemId - The id of the system the value is read back as.
 * @param {Owned} owned - The value with the id of the system that produced it.
 * @returns {unknown} The value, once its owner is proved to be that system.
 */
function reclaim(systemId: SystemId, owned: Readonly<Owned>): unknown {
  if (owned.systemId !== systemId) {
    throw new Error(`a value of system "${owned.systemId}" was read back as system "${systemId}"`);
  }
  return owned.value;
}

/**
 * A system's state, read back from the registry or a trace record.
 *
 * @param {System} system - The system that owns the state.
 * @param {Owned} owned - The state with its owner's id.
 * @returns {unknown} The state, typed as the system's own.
 */
function stateOf<TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
  system: Readonly<System<TState, TCommand, TEffect, TViewModel>>,
  owned: Readonly<Owned>,
): TState {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- reclaim proved the ids match, so the state is this system's own
  return reclaim(system.id, owned) as TState;
}

/**
 * A system's view-model, read back from the registry.
 *
 * @param {System} system - The system that rendered the view.
 * @param {Owned} owned - The view with its owner's id.
 * @returns {unknown} The view-model, typed as the system's own.
 */
function viewOf<TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
  system: Readonly<System<TState, TCommand, TEffect, TViewModel>>,
  owned: Readonly<Owned>,
): TViewModel {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- reclaim proved the ids match, so the view is this system's own
  return reclaim(system.id, owned) as TViewModel;
}

/**
 * A resume as the system receives it: a restored state is parsed by the system, every other resume
 * carries no state of the system's and passes as it is.
 *
 * @param {System} system - The system the resume is for.
 * @param {Resume} resume - The resume from the runtime.
 * @returns {Resume} The resume typed by the system's state.
 */
function resumeOf<TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
  system: Readonly<System<TState, TCommand, TEffect, TViewModel>>,
  resume: Readonly<Resume<unknown>>,
): Resume<TState> {
  return resume.kind === 'restored' ? { kind: 'restored', state: system.parseState(resume.state) } : resume;
}

/**
 * An input as the system receives it: a player command is parsed by the system, a resume through
 * `resumeOf`, and a story step or a lifecycle input carries nothing of the system's own.
 *
 * @param {System} system - The system the input is for.
 * @param {Input} input - The input from the runtime.
 * @returns {Input} The input typed by the system's state and commands.
 */
function inputOf<TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
  system: Readonly<System<TState, TCommand, TEffect, TViewModel>>,
  input: Readonly<Input<unknown>>,
): Input<TState, TCommand> {
  switch (input.source) {
    case 'story':
    case 'lifecycle': {
      return input;
    }
    case 'player': {
      return { command: system.parseCommand(input.command), source: 'player' };
    }
    case 'resume': {
      return { resume: resumeOf(system, input.resume), source: 'resume' };
    }
    default: {
      return assertNever(input);
    }
  }
}

/**
 * Erase a concrete system's generics for storage in the runtime registry.
 *
 * @param {System} system - The concrete system.
 * @returns {AnySystem} The system's functions over the registry's untyped values.
 */
function erase<TState, TCommand extends Command, TEffect extends Effect, TViewModel>(
  system: Readonly<System<TState, TCommand, TEffect, TViewModel>>,
): AnySystem {
  const own = (state: unknown): TState => stateOf(system, { systemId: system.id, value: state });
  return {
    id: system.id,
    init: (seed) => system.init(seed),
    parseState: (value) => system.parseState(value),
    reduce: (state, input, ctx) => system.reduce(own(state), inputOf(system, input), ctx),
    status: (state) => system.status(own(state)),
    tags: system.tags,
    view: (state, render) => system.view(own(state), render),
  };
}

export { erase, stateOf, viewOf };
export type { AnySystem, Owned, System };
