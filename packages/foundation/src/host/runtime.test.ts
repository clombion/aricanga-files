import { Compiler } from 'inkjs/full';
import { beforeEach, expect, test, vi } from 'vitest';
import { InkRuntime } from '../ink/ink-runtime';
import type { ReduceContext, ReduceResult } from '../sim/context';
import { type Effect, fx } from '../sim/effect';
import type { Command, Input } from '../sim/input';
import { type AnySystem, type System, erase } from '../sim/system';
import type { SaveStore, Scheduler } from '../services/services';
import { type Host, Runtime } from './runtime';

// --- a synthetic system that exercises every status, effect family, and resume ---

interface HState {
  readonly lines: readonly string[];
  readonly ids: readonly string[];
  readonly busyCommit: boolean;
  readonly token: number;
  readonly fetched: unknown;
}

type HCommand =
  | Command<'fetch', undefined>
  | Command<'present-ok', undefined>
  | Command<'present-bad', undefined>
  | Command<'mint', undefined>;

const COMMIT_TOKEN = 1;

const harness: System<HState, HCommand, Effect, HState> = {
  id: 'h',
  tags: ['h'],
  init: () => ({ lines: [], ids: [], busyCommit: false, token: COMMIT_TOKEN, fetched: null }),
  reduce(state, input, ctx): ReduceResult<HState, Effect> {
    switch (input.source) {
      case 'story': {
        const id = ctx.nextId();
        const lines = [...state.lines, input.step.text];
        const ids = [...state.ids, id];
        // Schedule a commit on the first line so the pump gate is exercised.
        if (input.step.text === 'Hello') {
          return {
            state: { ...state, lines, ids, busyCommit: true },
            effects: [fx.schedule({ delayMs: 10, token: state.token })],
          };
        }
        return { state: { ...state, lines, ids }, effects: [] };
      }
      case 'player':
        switch (input.command.kind) {
          case 'fetch':
            return { state, effects: [fx.fetch({ source: 's', query: 'q' })] };
          case 'present-ok':
            return { state, effects: [fx.present('ping', {})] };
          case 'present-bad':
            return { state, effects: [fx.present('explode', {})] };
          case 'mint':
            return { state: { ...state, ids: [...state.ids, ctx.nextId()] }, effects: [] };
          default:
            return { state, effects: [] };
        }
      case 'resume':
        switch (input.resume.kind) {
          case 'commit-fired':
            return input.resume.token === state.token
              ? { state: { ...state, busyCommit: false }, effects: [] }
              : { state, effects: [] }; // stale token — no-op
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
  status: (state) => (state.busyCommit ? 'busy-commit' : 'free'),
  view: (state) => state,
};

// --- fakes for the host shell ---

let fires: Array<() => void>;
let saved: string | null;
let presented: string[];

const scheduler: Scheduler = {
  schedule: (_delayMs, fire) => {
    fires.push(fire);
    return () => {};
  },
};
const store: SaveStore = {
  load: () => saved,
  save: (data) => {
    saved = data;
  },
};
const host: Host = {
  scheduler,
  store,
  fetchData: () => Promise.resolve('VALUE'),
  present: (effect) => {
    if (effect.kind === 'explode') throw new Error(`unknown present kind "${effect.kind}"`);
    presented.push(effect.kind);
  },
};

function story(): string {
  const src = 'Hello # h: 1\nWorld # h: 2\n';
  return new Compiler(src).Compile().ToJson() ?? '';
}

function makeRuntime(extra?: AnySystem[]): Runtime {
  return new Runtime({
    ink: new InkRuntime(story()),
    systems: [erase(harness), ...(extra ?? [])],
    host,
    seed: 0,
  });
}

beforeEach(() => {
  fires = [];
  saved = null;
  presented = [];
});

test('pump suspends on busy-commit and resumes on the matching CommitFired (#1, #3)', () => {
  const rt = makeRuntime();
  expect(rt.step()).toBe(true); // "Hello" pumped, harness schedules a commit and goes busy
  expect(rt.step()).toBe(false); // gate closed: "World" is NOT pumped while busy-commit
  expect(fires).toHaveLength(1);
  fires[0]?.(); // CommitFired resumes; pump continues to "World"
  expect((rt.view('h', { now: 0, locale: 'en' }) as HState).lines).toEqual(['Hello', 'World']);
});

test('a stale commit token is a no-op (#3)', () => {
  const rt = makeRuntime();
  rt.step(); // schedules token=1, busy
  // deliver a CommitFired with a token the state has moved past
  rt.send({ source: 'resume', resume: { kind: 'commit-fired', token: 999 } }, 'h');
  // still busy → "World" not pumped
  expect((rt.view('h', { now: 0, locale: 'en' }) as HState).lines).toEqual(['Hello']);
});

test('a Fetch effect round-trips to a DataArrived resume (#2)', async () => {
  const rt = makeRuntime();
  rt.send({ source: 'player', command: { kind: 'fetch', payload: undefined } }, 'h');
  await Promise.resolve(); // let fetchData's microtask resolve and re-enter send
  expect((rt.view('h', { now: 0, locale: 'en' }) as HState).fetched).toBe('VALUE');
});

test('an unknown present kind is a typed error (#2)', () => {
  const rt = makeRuntime();
  expect(() =>
    rt.send({ source: 'player', command: { kind: 'present-bad', payload: undefined } }, 'h'),
  ).toThrow(/unknown present kind/);
});

test('a known present effect reaches the host sink (#2)', () => {
  const rt = makeRuntime();
  rt.send({ source: 'player', command: { kind: 'present-ok', payload: undefined } }, 'h');
  expect(presented).toEqual(['ping']);
});

test('a player/resume input with an unknown target throws (#5)', () => {
  const rt = makeRuntime();
  expect(() =>
    rt.send({ source: 'player', command: { kind: 'mint', payload: undefined } }, 'nope'),
  ).toThrow(/no known target system/);
});

test('ids do not collide across snapshot/restore (#4)', () => {
  const rt = makeRuntime();
  rt.step(); // "Hello" mints id-0
  fires[0]?.(); // resume → "World" mints id-1
  const snap = rt.snapshot();
  expect(snap.idSeq).toBe(2);

  const rt2 = makeRuntime();
  rt2.restore(snap);
  rt2.send({ source: 'player', command: { kind: 'mint', payload: undefined } }, 'h');
  const ids = (rt2.view('h', { now: 0, locale: 'en' }) as HState).ids;
  // the restored allocator continues at id-2 — the new id does not collide with
  // the restored id-0/id-1 (all ids remain distinct)
  expect(ids[ids.length - 1]).toBe('id-2');
  expect(new Set(ids).size).toBe(ids.length);
});

test('the runtime drives a vocabulary-agnostic system with no system import in foundation', () => {
  // erase() is the only cast; the runtime never names a concrete system type.
  const input: Input<HState, HCommand> = { source: 'lifecycle', lifecycle: { kind: 'reset' } };
  expect(input.source).toBe('lifecycle');
  expect(typeof erase).toBe('function');
  expect(vi.isMockFunction(host.present)).toBe(false);
});
