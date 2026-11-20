/** The record of unscripted calls: a double trips here, and the guards read the record. */

/** The error a double throws on a call its test did not script. */
class TripwireError extends Error {
  public override readonly name = 'TripwireError';
}

/** The index the recorded trips start at. */
const FIRST_TRIP = 0;

const trips: string[] = [];

/**
 * Record an unscripted use and throw `TripwireError`.
 *
 * @param {string} message - What the double was asked that its test did not script.
 * @returns {never} Never: it always throws.
 */
function trip(message: string): never {
  trips.push(message);
  throw new TripwireError(message);
}

/**
 * Take every recorded trip.
 *
 * @returns {string[]} The trips' messages, in the order they were recorded; the record is then empty.
 */
function drain(): string[] {
  return trips.splice(FIRST_TRIP);
}

export { drain, trip, TripwireError };
