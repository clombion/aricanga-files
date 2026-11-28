/** The timer guard's wrappers, over stand-in real functions: a timer is pending until it fires or is cleared, and what is left is named with where it was set. */

import { describe, test } from 'vitest';
import { Timers } from '#lib/timers.ts';

/** The first item of a list. */
const FIRST = 0;

/** A stand-in for the real timer functions: it hands out handles and keeps what it was given. */
interface StandIn {
  /** Fires each handler it was given, in the order the timers were set. */
  readonly handlers: (() => void)[];
  /** The handles it was asked to clear. */
  readonly cleared: unknown[];
  readonly set: (self: unknown, args: readonly unknown[]) => number;
  readonly clear: (self: unknown, args: readonly unknown[]) => void;
}

/**
 * A fresh stand-in for the real timer functions.
 *
 * @returns {StandIn} The stand-in.
 */
function standIn(): StandIn {
  const handlers: (() => void)[] = [];
  const cleared: unknown[] = [];
  return {
    clear: (_self, args) => {
      cleared.push(args.at(FIRST));
    },
    cleared,
    handlers,
    set: (_self, args) => {
      const handler = args.at(FIRST);
      if (typeof handler === 'function') {
        handlers.push(() => {
          Reflect.apply(handler, undefined, []);
        });
      }
      return handlers.length;
    },
  };
}

describe('the timer guard', () => {
  test('names a timeout and an interval left pending, with where each was set, and clears them through the real functions', ({
    expect,
  }) => {
    expect.hasAssertions();
    const real = standIn();
    const timers = new Timers();
    timers.clear('timeout', real.clear);
    timers.clear('interval', real.clear);
    timers.timeout(real.set)(undefined, [real.clear]);
    timers.interval(real.set)(undefined, [real.clear]);
    const left = timers.clearLeft();
    expect(left.map((timer) => timer.split(' set at ').at(FIRST))).toStrictEqual(['timeout', 'interval']);
    expect(real.cleared).toHaveLength(left.length);
  });

  test('forgets a timeout once it fires, and calls its handler', ({ expect }) => {
    expect.hasAssertions();
    const real = standIn();
    const timers = new Timers();
    const called: string[] = [];
    timers.timeout(real.set)(undefined, [
      (): void => {
        called.push('fired');
      },
    ]);
    real.handlers.at(FIRST)?.();
    expect([called, timers.clearLeft()]).toStrictEqual([['fired'], []]);
  });

  test('forgets a timer that was cleared', ({ expect }) => {
    expect.hasAssertions();
    const real = standIn();
    const timers = new Timers();
    const handle = timers.interval(real.set)(undefined, [real.clear]);
    timers.clear('interval', real.clear)(undefined, [handle]);
    expect([timers.clearLeft(), real.cleared]).toStrictEqual([[], [handle]]);
  });

  test('fires a timeout whose handler is no function without calling it, and forgets it', ({ expect }) => {
    expect.hasAssertions();
    const real = standIn();
    const timers = new Timers();
    timers.timeout(real.set)(undefined, ['planted']);
    real.handlers.at(FIRST)?.();
    expect(timers.clearLeft()).toStrictEqual([]);
  });
});
