import type { ReduceContext, ReduceResult } from '../sim/context';
import { fx } from '../sim/effect';
import type { Effect } from '../sim/effect';
import { assertNever } from '../sim/exhaustive';
import type { Command, Input } from '../sim/input';
import { erase } from '../sim/system';
import type { System } from '../sim/system';
import type { AnySystem } from '../sim/system';

// A vocabulary-neutral system that can emit every effect family and handle a
// choose-command — so the harness can prove full-stream capture and choice-driving
// independent of chat/cards (which only emit Present today). Claims the `fx` tag.

/** @public */
export interface FixtureState {
  readonly lines: readonly string[];
  readonly busy: boolean;
  readonly token: number;
  readonly fetched: unknown;
  readonly saved: boolean;
}

/** @public */
export type FixtureCommand =
  | Command<'schedule', undefined>
  | Command<'fetch', undefined>
  | Command<'present', undefined>
  | Command<'persist', undefined>
  | Command<'choose', { readonly index: number }>;

export const FIXTURE_TAG = 'fx';

/** The part of a fixture system's state its resumes write: the commit gate and the fetched data. */
interface Gated {
  readonly busy: boolean;
  readonly token: number;
  readonly fetched: unknown;
}

/**
 * A fixture system's reduction of a resume or lifecycle input: a commit fired with the current token
 * opens the gate (a stale token is a no-op), arrived data is kept, and anything else changes nothing.
 */
function reduceResume<S extends Gated>(state: S, input: Input<S>): ReduceResult<S> {
  if (input.source !== 'resume') {
    return { effects: [], state };
  }
  switch (input.resume.kind) {
    case 'commit-fired': {
      return input.resume.token === state.token ? { state: { ...state, busy: false }, effects: [] } : { state, effects: [] };
    }
    case 'data-arrived': {
      return { state: { ...state, fetched: input.resume.value }, effects: [] };
    }
    case 'story-loaded':
    case 'restored': {
      return { state, effects: [] };
    }
    default: {
      return assertNever(input.resume);
    }
  }
}

/** The inputs a fixture system shapes itself: its story lines and player commands. */
type OwnInput<S, C extends Command> = Extract<Input<S, C>, { readonly source: 'story' | 'player' }>;

/**
 * A fixture system over a commit gate. `own` reduces its story lines and player commands; a resume or
 * lifecycle input goes through `reduceResume`; the gate is its status and its state is its view.
 */
export function gatedSystem<S extends Gated, C extends Command>(
  identity: { readonly id: string; readonly tags: readonly string[]; readonly init: (seed: number) => S },
  own: (state: S, input: OwnInput<S, C>, ctx: ReduceContext) => ReduceResult<S>,
): System<S, C, Effect, S> {
  return {
    ...identity,
    reduce: (state, input, ctx) =>
      input.source === 'story' || input.source === 'player' ? own(state, input, ctx) : reduceResume(state, input),
    status: (state) => (state.busy ? 'busy-commit' : 'free'),
    view: (state) => state,
  };
}

export const fixtureSystem: System<FixtureState, FixtureCommand, Effect, FixtureState> = gatedSystem<FixtureState, FixtureCommand>(
  { id: 'fixture', init: () => ({ lines: [], busy: false, token: 1, fetched: null, saved: false }), tags: [FIXTURE_TAG] },
  (state, input): ReduceResult<FixtureState> => {
    if (input.source === 'story') {
      const lines = [...state.lines, input.step.text];
      // A `commit` tag turns the line into a scheduled commit (exercises the gate).
      if (input.step.tags.some((t) => t.key === 'commit')) {
        return {
          effects: [fx.schedule({ delayMs: 1, token: state.token })],
          state: { ...state, busy: true, lines },
        };
      }
      return { effects: [fx.present('fixture/line', { text: input.step.text })], state: { ...state, lines } };
    }
    switch (input.command.kind) {
      case 'schedule': {
        return { state: { ...state, busy: true }, effects: [fx.schedule({ delayMs: 1, token: state.token })] };
      }
      case 'fetch': {
        return { state, effects: [fx.fetch({ source: 's', query: 'q' })] };
      }
      case 'present': {
        return { state, effects: [fx.present('fixture/ping', {})] };
      }
      case 'persist': {
        return { state, effects: [fx.persist()] };
      }
      case 'choose': {
        return { state, effects: [fx.driveInk({ op: 'choose', index: input.command.payload.index })] };
      }
      default: {
        return { state, effects: [] };
      }
    }
  },
);

/** The fixture system, erased for the runtime registry. */
export const fixtureSystemErased: AnySystem = erase(fixtureSystem);
