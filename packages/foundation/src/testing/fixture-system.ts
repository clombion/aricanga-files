import type { AnySystem, System } from '#src/sim/system';
import type { Command, Input } from '#src/sim/input';
import type { ReduceContext, ReduceResult } from '#src/sim/context';
import type { Effect } from '#src/sim/effect';
import { assertNever } from '#src/sim/exhaustive';
import { erase } from '#src/sim/system';
import { fx } from '#src/sim/effect';

/*
 * A vocabulary-neutral system that can emit every effect family and handle a
 * choose-command — so the harness can prove full-stream capture and choice-driving
 * independent of chat/cards (which only emit Present today). Claims the `fx` tag.
 */

/** @public */
interface FixtureState {
  readonly lines: readonly string[];
  readonly busy: boolean;
  readonly token: number;
  readonly fetched: unknown;
  readonly saved: boolean;
}

/** @public */
type FixtureCommand =
  | Command<'schedule', undefined>
  | Command<'fetch', undefined>
  | Command<'present', undefined>
  | Command<'persist', undefined>
  | Command<'choose', { readonly index: number }>;

/** The ink tag the fixture system claims. */
const FIXTURE_TAG = 'fx';

/** The commit token a fixture system starts at. */
const FIRST_TOKEN = 1;

/** How long a fixture system's scheduled commit waits, in milliseconds. */
const COMMIT_DELAY_MS = 1;

/** The part of a fixture system's state its resumes write: the commit gate and the fetched data. */
interface Gated {
  readonly busy: boolean;
  readonly token: number;
  readonly fetched: unknown;
}

/**
 * A fixture system's reduction of a resume or lifecycle input: a commit fired with the current token
 * opens the gate (a stale token is a no-op), arrived data is kept, and anything else changes nothing.
 *
 * @param {Gated} state - The system's state.
 * @param {Input} input - A resume or lifecycle input.
 * @returns {ReduceResult} The next state, with no effects.
 */
function reduceResume<TState extends Gated>(state: TState, input: Input<TState>): ReduceResult<TState> {
  if (input.source !== 'resume') {
    return { effects: [], state };
  }
  switch (input.resume.kind) {
    case 'commit-fired': {
      return input.resume.token === state.token ? { effects: [], state: { ...state, busy: false } } : { effects: [], state };
    }
    case 'data-arrived': {
      return { effects: [], state: { ...state, fetched: input.resume.value } };
    }
    case 'story-loaded':
    case 'restored': {
      return { effects: [], state };
    }
    default: {
      return assertNever(input.resume);
    }
  }
}

/** The inputs a fixture system shapes itself: its story lines and player commands. */
type OwnInput<TState, TCommand extends Command> = Extract<Input<TState, TCommand>, { readonly source: 'story' | 'player' }>;

/** A fixture system's identity: its id, the tags it claims and its initial state. */
interface Identity<TState> {
  readonly id: string;
  readonly tags: readonly string[];
  readonly init: (seed: number) => TState;
}

/**
 * A fixture system over a commit gate. `own` reduces its story lines and player commands; a resume or
 * lifecycle input goes through `reduceResume`; the gate is its status and its state is its view.
 *
 * @param {Identity} identity - The system's id, tags and initial state.
 * @param {Function} own - The reduction of its story lines and player commands.
 * @returns {System} The fixture system.
 */
function gatedSystem<TState extends Gated, TCommand extends Command>(
  identity: Readonly<Identity<TState>>,
  own: (state: TState, input: OwnInput<TState, TCommand>, ctx: ReduceContext) => ReduceResult<TState>,
): System<TState, TCommand, Effect, TState> {
  return {
    ...identity,
    reduce: (state, input, ctx) =>
      input.source === 'story' || input.source === 'player' ? own(state, input, ctx) : reduceResume(state, input),
    status: (state) => (state.busy ? 'busy-commit' : 'free'),
    view: (state) => state,
  };
}

/**
 * The fixture system's reduction of a player command.
 *
 * @param {FixtureState} state - The system's state.
 * @param {FixtureCommand} command - The command.
 * @returns {ReduceResult} The next state and the effect the command asks for.
 */
function reduceCommand(state: FixtureState, command: FixtureCommand): ReduceResult<FixtureState> {
  switch (command.kind) {
    case 'schedule': {
      return { effects: [fx.schedule({ delayMs: COMMIT_DELAY_MS, token: state.token })], state: { ...state, busy: true } };
    }
    case 'fetch': {
      return { effects: [fx.fetch({ query: 'q', source: 's' })], state };
    }
    case 'present': {
      return { effects: [fx.present('fixture/ping', {})], state };
    }
    case 'persist': {
      return { effects: [fx.persist()], state };
    }
    case 'choose': {
      return { effects: [fx.driveInk({ index: command.payload.index, op: 'choose' })], state };
    }
    default: {
      return assertNever(command);
    }
  }
}

const fixtureSystem: System<FixtureState, FixtureCommand, Effect, FixtureState> = gatedSystem<FixtureState, FixtureCommand>(
  {
    id: 'fixture',
    init: () => ({ busy: false, fetched: undefined, lines: [], saved: false, token: FIRST_TOKEN }),
    tags: [FIXTURE_TAG],
  },
  (state, input): ReduceResult<FixtureState> => {
    if (input.source === 'player') {
      return reduceCommand(state, input.command);
    }
    const lines = [...state.lines, input.step.text];
    // A `commit` tag turns the line into a scheduled commit (exercises the gate).
    if (input.step.tags.some((tag) => tag.key === 'commit')) {
      return { effects: [fx.schedule({ delayMs: COMMIT_DELAY_MS, token: state.token })], state: { ...state, busy: true, lines } };
    }
    return { effects: [fx.present('fixture/line', { text: input.step.text })], state: { ...state, lines } };
  },
);

/** The fixture system, erased for the runtime registry. */
const fixtureSystemErased: AnySystem = erase(fixtureSystem);

export { FIXTURE_TAG, fixtureSystem, fixtureSystemErased, gatedSystem };
export type { FixtureCommand, FixtureState };
