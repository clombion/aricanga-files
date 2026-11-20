import { InputRefusedError, commandOf, readerOf, unitCommands } from '#src/sim/parse';
import { describe, expect, test } from 'vitest';

/** The readers the tests parse with, refusing in the name of a system called `probe`. */
const READ = readerOf('probe');

/** A count, the value the number reader reads back. */
const COUNT = 1;

/** The position of a second entry in a list. */
const SECOND = 2;

/** A parser of two payload-less commands. */
const parseUnit = unitCommands('probe', ['start', 'stop']);

describe('a reader', () => {
  test('refuses a value of the wrong type, naming the system, what it expected and the value', () => {
    expect.hasAssertions();
    expect(() => READ.string(COUNT, 'a name')).toThrow(new InputRefusedError('system "probe" refuses a name: 1'));
    expect(() => READ.number('1', 'a count')).toThrow(new InputRefusedError('system "probe" refuses a count: "1"'));
    expect(() => READ.boolean('true', 'a flag')).toThrow(new InputRefusedError('system "probe" refuses a flag: "true"'));
    expect(() => READ.object([], 'a state')).toThrow(new InputRefusedError('system "probe" refuses a state: []'));
    expect(() => READ.object(undefined, 'a state')).toThrow(new InputRefusedError('system "probe" refuses a state: undefined'));
  });

  test('refuses a number that is not finite', () => {
    expect.hasAssertions();
    expect(() => READ.number(Number.NaN, 'a count')).toThrow(InputRefusedError);
    expect(() => READ.number(Number.POSITIVE_INFINITY, 'a count')).toThrow(InputRefusedError);
  });

  test('reads a list and a record entry by entry, naming where a refused entry sits', () => {
    expect.hasAssertions();
    expect(READ.list(['a', 'b'], 'names', READ.string)).toStrictEqual(['a', 'b']);
    expect(READ.record({ courage: COUNT }, 'counts', READ.number)).toStrictEqual({ courage: COUNT });
    expect(() => READ.list(['a', SECOND], 'names', READ.string)).toThrow(new InputRefusedError('system "probe" refuses names[1]: 2'));
    expect(() => READ.record({ courage: 'one' }, 'counts', READ.number)).toThrow(
      new InputRefusedError('system "probe" refuses counts.courage: "one"'),
    );
    expect(() => READ.list({}, 'names', READ.string)).toThrow(new InputRefusedError('system "probe" refuses names: {}'));
  });

  test('refuses a value present where nothing belongs, and passes an absent one', () => {
    expect.hasAssertions();
    expect(() => {
      READ.absent({}, 'a payload');
    }).toThrow(new InputRefusedError('system "probe" refuses a payload: {}'));
    expect(() => {
      READ.absent(undefined, 'a payload');
    }).not.toThrow();
  });
});

describe('a command parser', () => {
  test('reads each of its kinds back as the command it is', () => {
    expect.hasAssertions();
    expect(parseUnit({ kind: 'start', payload: undefined })).toStrictEqual({ kind: 'start', payload: undefined });
    expect(parseUnit({ kind: 'stop' })).toStrictEqual({ kind: 'stop', payload: undefined });
  });

  test('refuses a kind it does not take, a payload a unit command carries none of, and a value that is no command', () => {
    expect.hasAssertions();
    expect(() => parseUnit({ kind: 'pause', payload: undefined })).toThrow(
      new InputRefusedError('system "probe" refuses a command: {"kind":"pause"}'),
    );
    expect(() => parseUnit({ kind: 'start', payload: { at: COUNT } })).toThrow(
      new InputRefusedError('system "probe" refuses the start payload: {"at":1}'),
    );
    expect(() => parseUnit('start')).toThrow(new InputRefusedError('system "probe" refuses a command: "start"'));
  });

  test('leaves the payload of a kind it takes for the system to read', () => {
    expect.hasAssertions();
    expect(commandOf(READ, { kind: 'start', payload: { at: COUNT } }, ['start'])).toStrictEqual({ kind: 'start', payload: { at: COUNT } });
  });
});
