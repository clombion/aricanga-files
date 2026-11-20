import type { ReduceContext, ReduceResult } from '#src/sim/context';
import { gatedFields, gatedSystem } from '#src/testing/fixture-system';
import { readerOf, unitCommands } from '#src/sim/parse';
import type { Command } from '#src/sim/input';
import type { Effect } from '#src/sim/effect';
import type { System } from '#src/sim/system';
import { fx } from '#src/sim/effect';

/*
 * The runtime test's synthetic system: it records each story line, mints an id per line, schedules a
 * commit on its first line, and takes the commands that exercise every effect family.
 */

/** A synthetic system's state: the lines and ids it saw, its commit gate, and fetched data. */
interface HState {
  readonly lines: readonly string[];
  readonly ids: readonly string[];
  readonly busy: boolean;
  readonly token: number;
  readonly fetched: unknown;
}

/** The synthetic system's player commands. */
type HCommand =
  | Command<'fetch', undefined>
  | Command<'present-ok', undefined>
  | Command<'present-bad', undefined>
  | Command<'mint', undefined>;

/** The commit token the synthetic system starts at. */
const COMMIT_TOKEN = 1;

/** How long the synthetic system's commit waits, in milliseconds. */
const COMMIT_DELAY_MS = 10;

/**
 * The synthetic system's reduction of a story line: it records the line and mints an id, and the
 * first line, `Hello`, schedules a commit so the pump gate is exercised.
 *
 * @param {HState} state - The state.
 * @param {string} text - The line.
 * @param {ReduceContext} ctx - The reduce context.
 * @returns {ReduceResult} The next state and effects.
 */
function reduceLine(state: HState, text: string, ctx: ReduceContext): ReduceResult<HState> {
  const next = { ...state, ids: [...state.ids, ctx.nextId()], lines: [...state.lines, text] };
  if (text === 'Hello') {
    return { effects: [fx.schedule({ delayMs: COMMIT_DELAY_MS, token: state.token })], state: { ...next, busy: true } };
  }
  return { effects: [], state: next };
}

/**
 * The synthetic system's reduction of a player command.
 *
 * @param {HState} state - The state.
 * @param {HCommand} command - The command.
 * @param {ReduceContext} ctx - The reduce context.
 * @returns {ReduceResult} The next state and effects.
 */
function reduceCommand(state: HState, command: HCommand, ctx: ReduceContext): ReduceResult<HState> {
  switch (command.kind) {
    case 'fetch': {
      return { effects: [fx.fetch({ query: 'q', source: 's' })], state };
    }
    case 'present-ok': {
      return { effects: [fx.present('ping', {})], state };
    }
    case 'present-bad': {
      return { effects: [fx.present('explode', {})], state };
    }
    case 'mint': {
      return { effects: [], state: { ...state, ids: [...state.ids, ctx.nextId()] } };
    }
    default: {
      return { effects: [], state };
    }
  }
}

/** The synthetic system's readers. */
const READ = readerOf('h');

/**
 * Parse a restored synthetic state.
 *
 * @param {unknown} value - The restored value.
 * @returns {HState} The synthetic system's state; any other value is refused.
 */
function parseHState(value: unknown): HState {
  const state = READ.object(value, 'a state');
  return {
    ...gatedFields(READ, state),
    ids: READ.list(state['ids'], 'ids', READ.string),
    lines: READ.list(state['lines'], 'lines', READ.string),
  };
}

/** A synthetic system that exercises every status, effect family, and resume. */
const hSystem: System<HState, HCommand, Effect, HState> = gatedSystem<HState, HCommand>(
  {
    id: 'h',
    init: () => ({ busy: false, fetched: undefined, ids: [], lines: [], token: COMMIT_TOKEN }),
    parseCommand: unitCommands<HCommand['kind']>('h', ['fetch', 'present-ok', 'present-bad', 'mint']),
    parseState: parseHState,
    tags: ['h'],
  },
  (state, input, ctx) => (input.source === 'story' ? reduceLine(state, input.step.text, ctx) : reduceCommand(state, input.command, ctx)),
);

export { hSystem };
export type { HCommand, HState };
