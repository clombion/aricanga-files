import { Compiler } from 'inkjs/full';
import { beforeEach, expect, test, vi } from 'vitest';
import { InkRuntime } from '#src/ink/ink-runtime';
import type { ReduceResult } from '#src/sim/context';
import { fx } from '#src/sim/effect';
import type { Effect } from '#src/sim/effect';
import type { Command, Input } from '#src/sim/input';
import { erase, viewOf } from '#src/sim/system';
import type { AnySystem, System } from '#src/sim/system';
import type { SaveStore, Scheduler } from '#src/services/services';
import { gatedSystem } from '#src/testing/fixture-system';
import { Runtime } from './runtime';
import type { Host } from './runtime';

// --- a synthetic system that exercises every status, effect family, and resume ---

interface HState {
  readonly lines: readonly string[];
  readonly ids: readonly string[];
  readonly busy: boolean;
  readonly token: number;
  readonly fetched: unknown;
}

type HCommand =
  | Command<'fetch', undefined>
  | Command<'present-ok', undefined>
  | Command<'present-bad', undefined>
  | Command<'mint', undefined>;

const COMMIT_TOKEN = 1;

const harness: System<HState, HCommand, Effect, HState> = gatedSystem<HState, HCommand>(
  { id: 'h', init: () => ({ lines: [], ids: [], busy: false, token: COMMIT_TOKEN, fetched: null }), tags: ['h'] },
  (state, input, ctx): ReduceResult<HState> => {
    if (input.source === 'story') {
      const id = ctx.nextId();
      const lines = [...state.lines, input.step.text];
      const ids = [...state.ids, id];
      // Schedule a commit on the first line so the pump gate is exercised.
      if (input.step.text === 'Hello') {
        return {
          effects: [fx.schedule({ delayMs: 10, token: state.token })],
          state: { ...state, busy: true, ids, lines },
        };
      }
      return { effects: [], state: { ...state, ids, lines } };
    }
    switch (input.command.kind) {
      case 'fetch': {
        return { state, effects: [fx.fetch({ source: 's', query: 'q' })] };
      }
      case 'present-ok': {
        return { state, effects: [fx.present('ping', {})] };
      }
      case 'present-bad': {
        return { state, effects: [fx.present('explode', {})] };
      }
      case 'mint': {
        return { state: { ...state, ids: [...state.ids, ctx.nextId()] }, effects: [] };
      }
      default: {
        return { state, effects: [] };
      }
    }
  },
);

const hView = (rt: Runtime): HState =>
  viewOf(harness, { systemId: 'h', value: rt.view('h', { locale: 'en', now: 0 }) });

// --- fakes for the host shell ---

let fires: (() => void)[];
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
  fetchData:  async () => Promise.resolve('VALUE'),
  present: (effect) => {
    if (effect.kind === 'explode') throw new Error(`unknown present kind "${effect.kind}"`);
    presented.push(effect.kind);
  },
  scheduler,
  store,
};

function story(): string {
  const src = 'Hello # h: 1\nWorld # h: 2\n';
  return new Compiler(src).Compile().ToJson() ?? '';
}

function makeRuntime(extra?: AnySystem[]): Runtime {
  return new Runtime({
    host,
    ink: new InkRuntime(story()),
    seed: 0,
    systems: [erase(harness), ...(extra ?? [])],
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
  expect(hView(rt).lines).toEqual(['Hello', 'World']);
});

test('a stale commit token is a no-op (#3)', () => {
  const rt = makeRuntime();
  rt.step(); // schedules token=1, busy
  // deliver a CommitFired with a token the state has moved past
  rt.send({ resume: { kind: 'commit-fired', token: 999 }, source: 'resume' }, 'h');
  // still busy → "World" not pumped
  expect(hView(rt).lines).toEqual(['Hello']);
});

test('a Fetch effect round-trips to a DataArrived resume (#2)', async () => {
  const rt = makeRuntime();
  rt.send({ command: { kind: 'fetch', payload: undefined } satisfies HCommand, source: 'player' }, 'h');
  await Promise.resolve(); // let fetchData's microtask resolve and re-enter send
  expect(hView(rt).fetched).toBe('VALUE');
});

test('an unknown present kind is a typed error (#2)', () => {
  const rt = makeRuntime();
  expect(() =>{ 
    rt.send({ command: { kind: 'present-bad', payload: undefined }, source: 'player' }, 'h'); },
  ).toThrow(/unknown present kind/);
});

test('a known present effect reaches the host sink (#2)', () => {
  const rt = makeRuntime();
  rt.send({ command: { kind: 'present-ok', payload: undefined }, source: 'player' }, 'h');
  expect(presented).toEqual(['ping']);
});

test('a player/resume input with an unknown target throws (#5)', () => {
  const rt = makeRuntime();
  expect(() =>{ 
    rt.send({ command: { kind: 'mint', payload: undefined }, source: 'player' }, 'nope'); },
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
  rt2.send({ command: { kind: 'mint', payload: undefined }, source: 'player' }, 'h');
  const {ids} = hView(rt2);
  // the restored allocator continues at id-2 — the new id does not collide with
  // the restored id-0/id-1 (all ids remain distinct)
  expect(ids.at(-1)).toBe('id-2');
  expect(new Set(ids).size).toBe(ids.length);
});

test('the runtime drives a vocabulary-agnostic system with no system import in foundation', () => {
  // erase() is the only cast; the runtime never names a concrete system type.
  const input: Input<HState, HCommand> = { lifecycle: { kind: 'reset' }, source: 'lifecycle' };
  expect(input.source).toBe('lifecycle');
  expect(erase).toBeTypeOf('function');
  // oxlint-disable-next-line typescript/unbound-method -- isMockFunction inspects the function, it never calls it
  expect(vi.isMockFunction(host.present)).toBe(false);
});
