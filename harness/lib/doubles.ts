/**
 * Test doubles that refuse every call their test did not script.
 *
 * A double that meets an unscripted call trips: it records the trip and throws `TripwireError`.
 * JavaScript has no exception a `catch` cannot swallow, so the record is what counts: the guard setup
 * module fails a test after it ends when a trip was recorded, even if the code under test caught the
 * `TripwireError`, and fails the next test of the file when a double tripped after its own test ended.
 *
 * Write a double for each external system a test stands in for as a `Scripted` subclass, or a class
 * that calls `trip` on every use its test did not set up. Never decide what a fake is by its name.
 */

import { TripwireError, drain } from './tripwire.ts';
import { isEmpty } from './lists.ts';

/**
 * Throw if any trip was recorded, naming when it was seen.
 *
 * @param {string} when - When the trips were seen, for the error.
 */
function checkTrips(when: string): void {
  const taken = drain();
  if (!isEmpty(taken)) {
    throw new Error(`${when}: ${JSON.stringify(taken)}`);
  }
}

/**
 * Run `block`, expecting it to trip a double with a message containing `expected`; clear the trip.
 *
 * @param {string} expected - Text the trip's message must contain.
 * @param {() => void} block - The code expected to trip a double.
 */
function tripped(expected: string, block: () => void): void {
  try {
    block();
  } catch (error: unknown) {
    if (!(error instanceof TripwireError)) {
      throw error;
    }
  }
  const taken = drain();
  if (!taken.some((message) => message.includes(expected))) {
    throw new Error(`expected a trip naming ${JSON.stringify(expected)}, got ${JSON.stringify(taken)}`);
  }
}

export { Scripted } from './scripted.ts';
export { drain, trip, TripwireError } from './tripwire.ts';
export { checkTrips, tripped };
