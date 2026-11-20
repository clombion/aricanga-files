/** `CountedExemptions`: keys a rule tolerates a fixed number of times; a count off either way fails. */

import { ExemptionError } from './declaration-error.ts';
import { StaleExemptionError } from './errors.ts';
import { checkReasons } from './reasons.ts';

/** A key whose found count differs from its registered count. */
interface Mismatch {
  readonly key: string;
  readonly found: number;
  readonly registered: number;
}

/** The count of a key found nowhere, or registered nowhere. */
const NONE = 0;

/** The least count an entry may register, and the step of a count. */
const ONE = 1;

/** Keys a rule tolerates a fixed number of times; a count that differs either way fails. */
class CountedExemptions {
  public readonly entries: Readonly<ReadonlyMap<string, readonly [number, string]>>;

  /**
   * A list of counted exemptions.
   *
   * @param {Readonly<Record<string, readonly [number, string]>>} entries - Each key's count and reason, by key.
   */
  public constructor(entries: Readonly<Record<string, readonly [number, string]>>) {
    this.entries = new Map(Object.entries(entries));
    checkReasons([...this.entries].map(([key, [, reason]]: readonly [string, readonly [number, string]]) => [key, reason] as const));
    const low = [...this.entries]
      .filter(([, [count]]: readonly [string, readonly [number, string]]) => count < ONE)
      .map(([key]: readonly [string, readonly [number, string]]) => key);
    if (low.length > NONE) {
      throw new ExemptionError(`counted exemptions below one: ${JSON.stringify(low)}`);
    }
  }

  /**
   * Every key whose found count differs from its entry.
   *
   * @param {Readonly<Iterable<string>>} found - The findings' keys, a key once per finding.
   * @returns {Mismatch[]} The mismatches, sorted by key.
   */
  public mismatches(found: Readonly<Iterable<string>>): Mismatch[] {
    const counts = new Map<string, number>();
    for (const key of found) {
      counts.set(key, (counts.get(key) ?? NONE) + ONE);
    }
    const keys = new Set([...counts.keys(), ...this.entries.keys()]);
    return [...keys]
      .toSorted()
      .map((key): Mismatch => {
        const [registered = NONE] = this.entries.get(key) ?? [];
        return { found: counts.get(key) ?? NONE, key, registered };
      })
      .filter((mismatch) => mismatch.found !== mismatch.registered);
  }

  /**
   * Fail on a key found more often than registered (a new violation) or less (a stale count).
   *
   * @param {Readonly<Iterable<string>>} found - The findings' keys, a key once per finding.
   */
  public assertExact(found: Readonly<Iterable<string>>): void {
    const mismatches = this.mismatches(found);
    if (mismatches.length > NONE) {
      throw new StaleExemptionError(
        `counts differ from their entries (key, found, registered): ${JSON.stringify(mismatches)}`,
      );
    }
  }
}

export { CountedExemptions };
export type { Mismatch };
