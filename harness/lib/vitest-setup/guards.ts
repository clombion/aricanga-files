/**
 * The guards every test of the gate runs under: doubles that tripped fail their test (or the next,
 * for a late trip), the network beyond this machine is refused, and a test that leaves a timer
 * pending fails.
 */

import { afterEach, beforeEach } from 'vitest';

import { checkTrips } from '../doubles.ts';
import { install as guardNetwork } from '../network.ts';
import { install as guardTimers } from '../timers.ts';

let releaseNetwork: (() => void) | undefined;
let releaseTimers: (() => readonly string[]) | undefined;

beforeEach(() => {
  checkTrips('a double tripped after its test ended');
  releaseNetwork = guardNetwork().restore;
  releaseTimers = guardTimers().release;
});

afterEach(() => {
  releaseNetwork?.();
  const left = releaseTimers?.() ?? [];
  checkTrips('a double tripped and the code under test went on');
  if (left.length > 0) {
    throw new Error(`the test left ${left.length} timer(s) pending: ${left.join('; ')}`);
  }
});
