/** The timer guard names each timer a test leaves pending, with where it was set, and forgets one that fired or was cleared. */

import { describe, expect, test } from 'vitest';
import { install } from '#lib/timers.ts';
import { once } from 'node:events';

/** A delay no timer here reaches before the guard releases it. */
const LONG_MS = 60_000;

/** The delay of a timer that fires at once. */
const AT_ONCE_MS = 0;

/**
 * Wait for a timer that fires at once.
 *
 * @returns {Promise<void>} Settles once it fired.
 */
async function tick(): Promise<void> {
  const fired = new EventTarget();
  setTimeout(() => {
    fired.dispatchEvent(new Event('fired'));
  }, AT_ONCE_MS);
  await once(fired, 'fired');
}

/** A handler that does nothing when its timer fires. */
function idle(): void {
  // The planted timers only need to be pending.
}

describe('the timer guard', () => {
  test('names a timeout and an interval left pending, each with the line that set it', () => {
    expect.hasAssertions();
    const guard = install();
    setTimeout(idle, LONG_MS);
    setInterval(idle, LONG_MS);
    const left = guard.release();
    expect(left.map((timer) => timer.replace(/ set at .*timers\.test\.ts:\d+:\d+\)?$/u, ' set here'))).toStrictEqual([
      'timeout set here',
      'interval set here',
    ]);
  });

  test('forgets a timeout that fired and timers that were cleared', async () => {
    expect.hasAssertions();
    const guard = install();
    await tick();
    clearTimeout(setTimeout(idle, LONG_MS));
    clearInterval(setInterval(idle, LONG_MS));
    expect(guard.release()).toStrictEqual([]);
  });

  test('fires a timeout whose handler is no function, as the platform would, and forgets it', async () => {
    expect.hasAssertions();
    const guard = install();
    Reflect.apply(setTimeout, globalThis, ['planted', AT_ONCE_MS]);
    await tick();
    expect(guard.release()).toStrictEqual([]);
  });
});
