import type { ReduceResult } from '../sim/context';
import { type Effect, fx } from '../sim/effect';
import type { Command } from '../sim/input';
import { type System, erase } from '../sim/system';
import type { AnySystem } from '../sim/system';

// A vocabulary-neutral system that can emit every effect family and handle a
// choose-command — so the harness can prove full-stream capture and choice-driving
// independent of chat/cards (which only emit Present today). Claims the `fx` tag.

export interface FixtureState {
  readonly lines: readonly string[];
  readonly busy: boolean;
  readonly token: number;
  readonly fetched: unknown;
  readonly saved: boolean;
}

export type FixtureCommand =
  | Command<'schedule', undefined>
  | Command<'fetch', undefined>
  | Command<'present', undefined>
  | Command<'persist', undefined>
  | Command<'choose', { readonly index: number }>;

export const FIXTURE_TAG = 'fx';

export const fixtureSystem: System<FixtureState, FixtureCommand, Effect, FixtureState> = {
  id: 'fixture',
  tags: [FIXTURE_TAG],
  init: () => ({ lines: [], busy: false, token: 1, fetched: null, saved: false }),
  reduce(state, input): ReduceResult<FixtureState, Effect> {
    switch (input.source) {
      case 'story': {
        const lines = [...state.lines, input.step.text];
        // A `commit` tag turns the line into a scheduled commit (exercises the gate).
        if (input.step.tags.some((t) => t.key === 'commit')) {
          return {
            state: { ...state, lines, busy: true },
            effects: [fx.schedule({ delayMs: 1, token: state.token })],
          };
        }
        return { state: { ...state, lines }, effects: [fx.present('fixture/line', { text: input.step.text })] };
      }
      case 'player':
        switch (input.command.kind) {
          case 'schedule':
            return { state: { ...state, busy: true }, effects: [fx.schedule({ delayMs: 1, token: state.token })] };
          case 'fetch':
            return { state, effects: [fx.fetch({ source: 's', query: 'q' })] };
          case 'present':
            return { state, effects: [fx.present('fixture/ping', {})] };
          case 'persist':
            return { state, effects: [fx.persist()] };
          case 'choose':
            return { state, effects: [fx.driveInk({ op: 'choose', index: input.command.payload.index })] };
          default:
            return { state, effects: [] };
        }
      case 'resume':
        switch (input.resume.kind) {
          case 'commit-fired':
            return input.resume.token === state.token
              ? { state: { ...state, busy: false }, effects: [] }
              : { state, effects: [] };
          case 'data-arrived':
            return { state: { ...state, fetched: input.resume.value }, effects: [] };
          default:
            return { state, effects: [] };
        }
      case 'lifecycle':
        return { state, effects: [] };
      default:
        return { state, effects: [] };
    }
  },
  status: (state) => (state.busy ? 'busy-commit' : 'free'),
  view: (state) => state,
};

/** The fixture system, erased for the runtime registry. */
export const fixtureSystemErased: AnySystem = erase(fixtureSystem);
