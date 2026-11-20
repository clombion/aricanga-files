/**
 * Test doubles that refuse every call their test did not script.
 *
 * A double that meets an unscripted call trips: it records the trip and throws `Tripwire`. JavaScript
 * has no exception a `catch` cannot swallow, so the record is what counts: the guard setup module
 * fails a test after it ends when a trip was recorded, even if the code under test caught the
 * `Tripwire`, and fails the next test of the file when a double tripped after its own test ended.
 *
 * Write a double for each external system a test stands in for as a `Scripted` subclass, or a class
 * that calls `trip` on every use its test did not set up. Never decide what a fake is by its name.
 */

export class Tripwire extends Error {
  override readonly name = 'Tripwire';
}

const trips: string[] = [];

/** Record an unscripted use and throw `Tripwire`. */
export function trip(message: string): never {
  trips.push(message);
  throw new Tripwire(message);
}

/** Take every recorded trip. */
export function drain(): string[] {
  return trips.splice(0);
}

/** Throw if any trip was recorded, naming when it was seen. */
export function checkTrips(when: string): void {
  const taken = drain();
  if (taken.length > 0) {
    throw new Error(`${when}: ${JSON.stringify(taken)}`);
  }
}

/** Run `block`, expecting it to trip a double with a message containing `expected`; clear the trip. */
export function tripped(expected: string, block: () => void): void {
  try {
    block();
  } catch (error) {
    if (!(error instanceof Tripwire)) {
      throw error;
    }
  }
  const taken = drain();
  if (!taken.some((message) => message.includes(expected))) {
    throw new Error(`expected a trip naming ${JSON.stringify(expected)}, got ${JSON.stringify(taken)}`);
  }
}

/** A double that answers only the calls its test scripted: `script` maps each call to its answer. */
export class Scripted<V> {
  readonly script: ReadonlyMap<string, V>;
  readonly calls: string[] = [];

  constructor(script: Readonly<Record<string, V>>) {
    this.script = new Map(Object.entries(script));
  }

  /** The scripted answer to `call`; an unscripted call trips. */
  answer(call: string): V {
    this.calls.push(call);
    const scripted = this.script.get(call);
    if (scripted === undefined) {
      return trip(`${this.constructor.name} got an unscripted call ${JSON.stringify(call)}`);
    }
    return scripted;
  }
}
