/**
 * A scripted double fails its test on an unscripted call, even when the code under test catches it.
 *
 * Planted through a Vitest run under the gate's guards: the code under test wraps the unscripted
 * call in a `catch`, and a hook that outlives its tests trips after they ended, which fails the next
 * test of the file. A scripted call, and the test after a clean one, pass.
 */

import { describe, expect, test } from 'vitest';

import { Scripted, Tripwire, checkTrips, drain, trip, tripped } from '../lib/doubles.ts';
import { runPlanted } from '../lib/planted-vitest.ts';

export const HARNESS_ID = 'doubles';

const PLANTED = `import { afterAll, describe, expect, test } from 'vitest';
import { Scripted } from '../harness/lib/doubles.ts';

class Store extends Scripted<number> {}

function codeUnderTest(store: Store): number {
  try {
    return store.answer('unscripted');
  } catch {
    return 0;
  }
}

describe('first', () => {
  afterAll(() => {
    try {
      new Store({}).answer('late');
    } catch {
      // the planted code swallows the trip
    }
  });
  test('a caught unscripted call fails', () => {
    expect(codeUnderTest(new Store({ scripted: 1 }))).toBe(0);
  });
  test('a scripted call passes', () => {
    expect(new Store({ scripted: 1 }).answer('scripted')).toBe(1);
  });
});

describe('second', () => {
  test('runs after the late trip', () => {
    expect(1).toBe(1);
  });
});
`;

class Weather extends Scripted<string> {}

describe('a scripted double', () => {
  test('answers a scripted call and records it', () => {
    const weather = new Weather({ Lisbon: 'sun' });
    expect(weather.answer('Lisbon')).toBe('sun');
    expect(weather.calls).toEqual(['Lisbon']);
  });

  test('trips on an unscripted call, past a catch', () => {
    const weather = new Weather({});
    let caught: unknown;
    expect(() => {
      tripped('unscripted call "Paris"', () => {
        try {
          weather.answer('Paris');
        } catch (error) {
          caught = error;
        }
      });
    }).not.toThrow();
    expect(caught).toBeInstanceOf(Tripwire);
  });

  test('a recorded trip fails the check, and draining clears it', () => {
    expect(() => trip('planted')).toThrow(Tripwire);
    expect(() => {
      checkTrips('after the test');
    }).toThrow('after the test: ["planted"]');
    expect(drain()).toEqual([]);
  });

  test('tripped fails when nothing tripped', () => {
    expect(() => {
      tripped('never', () => {});
    }).toThrow('expected a trip naming "never"');
  });
});

describe('the guards, through a planted Vitest run', () => {
  test('fail a caught unscripted call and the test after a late trip, and pass the rest', () => {
    const outcomes = runPlanted({ 'doubles.test.ts': PLANTED });
    expect([...outcomes].map(([name, outcome]) => [name, outcome.status])).toEqual([
      ['first a caught unscripted call fails', 'failed'],
      ['first a scripted call passes', 'passed'],
      ['second runs after the late trip', 'failed'],
    ]);
    expect(outcomes.get('first a caught unscripted call fails')?.failure).toContain('a double tripped and the code under test went on');
    expect(outcomes.get('second runs after the late trip')?.failure).toContain('a double tripped after its test ended');
  });
});
