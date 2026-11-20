/**
 * The guards every test of the gate runs under: doubles that tripped fail their test (or the next,
 * for a late trip), the network beyond this machine is refused, and a test that leaves a timer
 * pending fails.
 */

import { Slot, isEmpty } from './lists.ts';
import { afterEach, beforeEach } from 'vitest';
import { checkTrips } from './doubles.ts';
import { install as guardNetwork } from './network.ts';
import { install as guardTimers } from './timers.ts';

/** What the current test's guards release when it ends. */
interface Releases {
  readonly network: () => void;
  readonly timers: () => readonly string[];
}

/** The guards of the test running now, replaced before each test. */
const current = new Slot<Releases>();

beforeEach(() => {
  checkTrips('a double tripped after its test ended');
  current.put({ network: guardNetwork().restore, timers: guardTimers().release });
});

afterEach(() => {
  const releases = current.take();
  releases?.network();
  const left = releases?.timers() ?? [];
  checkTrips('a double tripped and the code under test went on');
  if (!isEmpty(left)) {
    throw new Error(`the test left ${left.length} timer(s) pending: ${left.join('; ')}`);
  }
});
