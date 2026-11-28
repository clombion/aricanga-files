import { checkInvariant, inkStepArb, runFixture, runStream } from '#src/testing/index';
import { describe, test } from 'vitest';
import { erase, viewOf } from '#src/sim/system';
import { readerOf, unitCommands } from '#src/sim/parse';
import { sample, constant as single } from 'fast-check';
import type { Command } from '#src/sim/input';
import type { Effect } from '#src/sim/effect';
import type { FixtureInput } from '#src/testing/harness';
import type { HCommand } from '#test/h-system';
import type { System } from '#src/sim/system';
import { fx } from '#src/sim/effect';
import { hSystem } from '#test/h-system';

/** The data the responder answers every fetch with. */
const ANSWER = 'answered';

/** The seed a run starts its systems from. */
const SEED = 7;

/** The step a violation is reported at. */
const STEP = 3;

/** How many generated streams a property check runs here. */
const RUNS = 1;

/** How many steps a generator sample draws. */
const SAMPLES = 20;

/** A timer's delay; the harness fires timers itself, so the delay is never waited. */
const DELAY_MS = 1;

/** One more fired timer. */
const NEXT = 1;

/** What the looping system counts: the timers it has scheduled. */
interface LoopState {
  readonly fired: number;
}

/** The looping system's readers. */
const READ = readerOf('loop');

/** A system whose every fired timer schedules the next, so a run never drains. */
const loopSystem: System<LoopState, Command<'start', undefined>, Effect, LoopState> = {
  id: 'loop',
  init: () => ({ fired: 0 }),
  parseCommand: unitCommands('loop', ['start']),
  parseState: (value) => ({ fired: READ.number(READ.object(value, 'a state')['fired'], 'fired') }),
  reduce: (state, input) =>
    input.source === 'player' || input.source === 'resume'
      ? { effects: [fx.schedule({ delayMs: DELAY_MS, token: state.fired })], state: { fired: state.fired + NEXT } }
      : { effects: [], state },
  status: () => 'free',
  tags: [],
  view: (state) => state,
};

/** The player starts the looping system. */
const START: FixtureInput = { input: { command: { kind: 'start', payload: undefined }, source: 'player' }, target: 'loop' };

/** The player asks the synthetic system to fetch. */
const FETCH: FixtureInput = { input: { command: { kind: 'fetch', payload: undefined } satisfies HCommand, source: 'player' }, target: 'h' };

describe('the fixture harness', () => {
  test('refuses a run whose timers never drain', async ({ expect }) => {
    expect.hasAssertions();
    await expect(runFixture({ inputs: [START], story: 'Only line.\n', systems: [erase(loopSystem)] })).rejects.toThrow(
      'runFixture: drain did not converge',
    );
  });

  test('passes a run its foreground, seed and fetch responder', async ({ expect }) => {
    expect.hasAssertions();
    const run = await runStream({ fetch: () => ANSWER, foreground: 'h', seed: SEED, systems: [erase(hSystem)] }, [FETCH]);
    expect(run.viewOf(hSystem).fetched).toBe(ANSWER);
    expect(viewOf(hSystem, { systemId: 'h', value: run.snapshot.state['h'] }).fetched).toBe(ANSWER);
  });
});

describe('the invariant check', () => {
  test('reports a violation with its rule, its detail and the step it was found at', async ({ expect }) => {
    expect.hasAssertions();
    const found = await checkInvariant({ runs: RUNS, systems: [erase(hSystem)] }, single([]), () => ({
      at: STEP,
      detail: 'planted',
      rule: 'always',
    }));
    expect(found.failed).toBe(true);
    expect(found.message).toContain(`always: planted @${String(STEP)}`);
  });

  test('reports a violation found at no particular step without one', async ({ expect }) => {
    expect.hasAssertions();
    const found = await checkInvariant({ runs: RUNS, systems: [erase(hSystem)] }, single([]), () => ({
      detail: 'planted',
      rule: 'always',
    }));
    expect(found.message).toContain('always: planted\n');
  });
});

describe('the step generator', () => {
  test('draws texts from a fixed pool and tags from the speaker key by default', ({ expect }) => {
    expect.hasAssertions();
    const pool = new Set(['one', 'two']);
    const steps = sample(inkStepArb({ texts: [...pool] }), SAMPLES);
    expect(steps.every((step) => pool.has(step.text))).toBe(true);
    expect(steps.flatMap((step) => step.tags).every((tag) => tag.key === 'speaker')).toBe(true);
  });
});
