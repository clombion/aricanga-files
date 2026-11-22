import { describe, expect, test } from 'vitest';
import { InkRuntime } from '#src/ink/ink-runtime';
import { compileInk } from '#src/testing/compile';

/** A story declaring every external the runtime binds, calling each once. */
const EXTERNALS = `EXTERNAL name(id)
EXTERNAL data(key)
EXTERNAL delay_next(seconds)
EXTERNAL play_sound(sound)
EXTERNAL advance_day()
EXTERNAL request_data(source, query, params)
Hello {name("pat")} and {data("weather")}.
~ delay_next(2)
~ play_sound("ping")
~ advance_day()
Fetched {request_data("gem", "units", "all")}.
Then on.
`;

/** The seconds the story delays its next line by. */
const DELAY = 2;

/** A story whose externals take values ink passes as numbers and booleans. */
const PRIMITIVES = `EXTERNAL name(id)
EXTERNAL delay_next(seconds)
Number {name(7)} and truth {name(true)}.
~ delay_next("3")
Done.
`;

/** The seconds the text "3" reads as. */
const THREE = 3;

/** A story requesting data with no parameters. */
const NO_PARAMS = `EXTERNAL request_data(source, query)
Fetched {request_data("gem", "units")}.
`;

/** A story passing an ink list, which is no primitive, to an external. */
const LIST_ARGUMENT = `EXTERNAL name(id)
LIST colours = red, green
Colour {name(red)}.
`;

describe('the ink runtime', () => {
  test('resolves names and data through the lookups it is given', () => {
    expect.hasAssertions();
    const ink = new InkRuntime(compileInk(EXTERNALS), {
      data: (key): string => `data:${key}`,
      name: (id): string => `name:${id}`,
    });
    expect(ink.continue().text).toBe('Hello name:pat and data:weather.');
  });

  test('passes a name or a data key through as itself without a lookup', () => {
    expect.hasAssertions();
    const ink = new InkRuntime(compileInk(EXTERNALS));
    expect(ink.continue().text).toBe('Hello pat and weather.');
  });

  test('drains the externals a line calls into its step, and waits for requested data', () => {
    expect.hasAssertions();
    const ink = new InkRuntime(compileInk(EXTERNALS));
    ink.continue();
    const step = ink.continue();
    expect(step.externalCalls).toStrictEqual([
      { fn: 'delay_next', seconds: DELAY },
      { fn: 'play_sound', sound: 'ping' },
      { fn: 'advance_day' },
      { fn: 'request_data', params: 'all', query: 'units', source: 'gem' },
    ]);
    expect(step.status).toBe('await-data');
  });

  test('reads a number or a boolean ink passes an external as its text, and a numeric text as a number', () => {
    expect.hasAssertions();
    const ink = new InkRuntime(compileInk(PRIMITIVES));
    expect(ink.continue().text).toBe('Number 7 and truth true.');
    expect(ink.continue().externalCalls).toStrictEqual([{ fn: 'delay_next', seconds: THREE }]);
  });

  test('drains a data request with no parameters without inventing them', () => {
    expect.hasAssertions();
    const ink = new InkRuntime(compileInk(NO_PARAMS));
    expect(ink.continue().externalCalls).toStrictEqual([{ fn: 'request_data', query: 'units', source: 'gem' }]);
  });

  test('refuses a value ink passes an external that is no primitive', () => {
    expect.hasAssertions();
    const ink = new InkRuntime(compileInk(LIST_ARGUMENT));
    expect(() => ink.continue()).toThrow('ink passed an external a object, not a primitive');
  });
});
