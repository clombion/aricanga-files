import { describe, expect, test } from 'vitest';
import { fixtureSystem, fixtureSystemErased } from '#src/testing/fixture-system';
import type { FixtureCommand } from '#src/testing/fixture-system';
import type { Host } from '#src/host/runtime';
import { InkRuntime } from '#src/ink/ink-runtime';
import { Runtime } from '#src/host/runtime';
import { compileInk } from '#src/testing/harness';
import { throughSave } from '#src/testing/saved';

/** The seed a fixture state starts from. */
const SEED = 0;

/** The choice a choose command picks. */
const SECOND_CHOICE = 1;

/** One of every fixture command, each as a player would send it. */
const EVERY_COMMAND: readonly FixtureCommand[] = [
  { kind: 'schedule', payload: undefined },
  { kind: 'fetch', payload: undefined },
  { kind: 'present', payload: undefined },
  { kind: 'persist', payload: undefined },
  { kind: 'choose', payload: { index: SECOND_CHOICE } },
];

/**
 * A saved state with one more field than its system holds, as a save from an older shape would have.
 *
 * @param {unknown} state - The state.
 * @returns {unknown} The state with a `retired` field.
 */
function withRetiredField(state: unknown): unknown {
  return typeof state === 'object' && state !== null ? { ...state, retired: true } : state;
}

/**
 * A runtime over the fixture system alone, under a host that does nothing.
 *
 * @returns {Runtime} The runtime.
 */
function runtime(): Runtime {
  const nothing: { readonly saved?: string } = {};
  const host: Host = {
    fetchData: () => {
      // No fetch is answered: the tests read only what the system parses.
    },
    present: () => {
      // Nothing is shown.
    },
    scheduler: {
      schedule: () => () => {
        // A timer is never cancelled.
      },
    },
    store: {
      load: () => nothing.saved,
      save: () => {
        // Nothing is saved.
      },
    },
  };
  return new Runtime({ host, ink: new InkRuntime(compileInk('Start # fx: 1\n')), seed: 0, systems: [fixtureSystemErased] });
}

describe('the runtime boundary', () => {
  test('refuses a command the addressed system does not take, naming the system and the value', () => {
    expect.hasAssertions();
    expect(() => {
      runtime().send({ command: { kind: 'detonate', payload: undefined }, source: 'player' }, 'fixture');
    }).toThrow('system "fixture" refuses a command: {"kind":"detonate"}');
  });

  test('refuses a snapshot whose state for a system is not that system’s state', () => {
    expect.hasAssertions();
    const live = runtime();
    expect(() => {
      live.restore({ ...live.snapshot(), state: { fixture: { lines: 'not a list' } } });
    }).toThrow('system "fixture" refuses busy: undefined');
  });

  test('refuses a restored resume whose state is not the system’s state', () => {
    expect.hasAssertions();
    expect(() => {
      runtime().send({ resume: { kind: 'restored', state: { busy: 'no' } }, source: 'resume' }, 'fixture');
    }).toThrow('system "fixture" refuses busy: "no"');
  });

  test('restores a state read back from saved text as the system parses it, keeping none of a field it does not hold', () => {
    expect.hasAssertions();
    const live = runtime();
    live.send({ command: { kind: 'present', payload: undefined }, source: 'player' }, 'fixture');
    const saved = live.snapshot();
    const restored = runtime();
    restored.restore({ ...saved, state: { fixture: throughSave(withRetiredField(saved.state['fixture'])) } });
    expect(restored.snapshot().state).toStrictEqual(saved.state);
  });
});

describe('the fixture system’s parsers', () => {
  test('read every command back from saved text as the command it is', () => {
    expect.hasAssertions();
    expect(EVERY_COMMAND.map((command) => fixtureSystem.parseCommand(throughSave(command)))).toStrictEqual(EVERY_COMMAND);
  });

  test('refuse a choose whose index is not a number', () => {
    expect.hasAssertions();
    expect(() => fixtureSystem.parseCommand({ kind: 'choose', payload: { index: '1' } })).toThrow('system "fixture" refuses index: "1"');
  });

  test('read a state back from saved text as the state it is', () => {
    expect.hasAssertions();
    const state = { ...fixtureSystem.init(SEED), lines: ['Start'], saved: true };
    expect(fixtureSystem.parseState(throughSave(state))).toStrictEqual(state);
  });
});
