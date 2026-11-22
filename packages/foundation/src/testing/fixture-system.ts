import type { AnySystem, System } from '#src/sim/system';
import type { Command, Input, Resume } from '#src/sim/input';
import type { ReduceContext, ReduceResult } from '#src/sim/context';
import { commandOf, readerOf } from '#src/sim/parse';
import type { Effect } from '#src/sim/effect';
import type { Reader } from '#src/sim/parse';
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

/** Each resume kind's reduction, taking the resume of its own kind. */
type ResumeHandlers<TState> = {
  readonly [TKind in Resume<TState>['kind']]: (resume: Extract<Resume<TState>, { readonly kind: TKind }>) => ReduceResult<TState>;
};

/**
 * A resume reduced by the handler of its own kind.
 *
 * @param {ResumeHandlers} handlers - One handler per resume kind.
 * @param {Resume} resume - The resume.
 * @returns {ReduceResult} What its handler gives.
 */
function resumeBy<TState, TKind extends Resume<TState>['kind']>(
  handlers: Readonly<ResumeHandlers<TState>>,
  resume: Extract<Resume<TState>, { readonly kind: TKind }>,
): ReduceResult<TState> {
  const handler: ResumeHandlers<TState>[TKind] = handlers[resume.kind];
  return handler(resume);
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
  const handlers: ResumeHandlers<TState> = {
    'commit-fired': (resume) => (resume.token === state.token ? { effects: [], state: { ...state, busy: false } } : { effects: [], state }),
    'data-arrived': (resume) => ({ effects: [], state: { ...state, fetched: resume.value } }),
    restored: () => ({ effects: [], state }),
    'story-loaded': () => ({ effects: [], state }),
  };
  return resumeBy(handlers, input.resume);
}

/** The inputs a fixture system shapes itself: its story lines and player commands. */
type OwnInput<TState, TCommand extends Command> = Extract<Input<TState, TCommand>, { readonly source: 'story' | 'player' }>;

/**
 * A fixture system's identity: its id, the tags it claims, its initial state, and the parsers of its
 * commands and of a restored state.
 */
interface Identity<TState, TCommand extends Command> {
  readonly id: string;
  readonly tags: readonly string[];
  readonly init: (seed: number) => TState;
  readonly parseCommand: (value: unknown) => TCommand;
  readonly parseState: (value: unknown) => TState;
}

/**
 * The commit-gate fields of a restored fixture state, read from its object.
 *
 * @param {Reader} read - The system's readers.
 * @param {Readonly<Record<string, unknown>>} state - The restored state's fields.
 * @returns {Gated} The gate and the fetched data.
 */
function gatedFields(read: Readonly<Reader>, state: Readonly<Record<string, unknown>>): Gated {
  return {
    busy: read.boolean(state['busy'], 'busy'),
    fetched: state['fetched'],
    token: read.number(state['token'], 'token'),
  };
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
  identity: Readonly<Identity<TState, TCommand>>,
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

/** Each fixture command's reduction, taking the command of its own kind. */
type CommandHandlers = {
  readonly [TKind in FixtureCommand['kind']]: (
    state: FixtureState,
    command: Extract<FixtureCommand, { readonly kind: TKind }>,
  ) => ReduceResult<FixtureState>;
};

/** What each fixture command does: the effect it asks for, and the gate a schedule closes. */
const COMMANDS: CommandHandlers = {
  choose: (state, command) => ({ effects: [fx.driveInk({ index: command.payload.index, op: 'choose' })], state }),
  fetch: (state) => ({ effects: [fx.fetch({ query: 'q', source: 's' })], state }),
  persist: (state) => ({ effects: [fx.persist()], state }),
  present: (state) => ({ effects: [fx.present('fixture/ping', {})], state }),
  schedule: (state) => ({ effects: [fx.schedule({ delayMs: COMMIT_DELAY_MS, token: state.token })], state: { ...state, busy: true } }),
};

/**
 * The fixture system's reduction of a player command.
 *
 * @param {FixtureState} state - The system's state.
 * @param {FixtureCommand} command - The command.
 * @returns {ReduceResult} The next state and the effect the command asks for.
 */
function reduceCommand<TKind extends FixtureCommand['kind']>(
  state: FixtureState,
  command: Extract<FixtureCommand, { readonly kind: TKind }>,
): ReduceResult<FixtureState> {
  const handler: CommandHandlers[TKind] = COMMANDS[command.kind];
  return handler(state, command);
}

/** The fixture system's id. */
const FIXTURE_ID = 'fixture';

/** The fixture system's readers. */
const READ = readerOf(FIXTURE_ID);

/** The fixture system's command kinds. */
const FIXTURE_KINDS: readonly FixtureCommand['kind'][] = ['schedule', 'fetch', 'present', 'persist', 'choose'];

/**
 * Parse a command for the fixture system.
 *
 * @param {unknown} value - The inbound value.
 * @returns {FixtureCommand} One of the fixture system's commands; any other value is refused.
 */
function parseFixtureCommand(value: unknown): FixtureCommand {
  const command = commandOf(READ, value, FIXTURE_KINDS);
  if (command.kind === 'choose') {
    return { kind: 'choose', payload: { index: READ.number(READ.object(command.payload, 'the choose payload')['index'], 'index') } };
  }
  READ.absent(command.payload, `the ${command.kind} payload`);
  return { kind: command.kind, payload: undefined };
}

/**
 * Parse a restored fixture state.
 *
 * @param {unknown} value - The restored value.
 * @returns {FixtureState} The fixture system's state; any other value is refused.
 */
function parseFixtureState(value: unknown): FixtureState {
  const state = READ.object(value, 'a state');
  return {
    ...gatedFields(READ, state),
    lines: READ.list(state['lines'], 'lines', READ.string),
    saved: READ.boolean(state['saved'], 'saved'),
  };
}

const fixtureSystem: System<FixtureState, FixtureCommand, Effect, FixtureState> = gatedSystem<FixtureState, FixtureCommand>(
  {
    id: FIXTURE_ID,
    init: () => ({ busy: false, fetched: undefined, lines: [], saved: false, token: FIRST_TOKEN }),
    parseCommand: parseFixtureCommand,
    parseState: parseFixtureState,
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

export { FIXTURE_TAG, fixtureSystem, fixtureSystemErased, gatedFields, gatedSystem };
export type { FixtureCommand, FixtureState };
