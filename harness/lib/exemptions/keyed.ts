/** `Exemptions`: keys a rule tolerates, each with its reason; an entry no finding matches fails. */

import { ExemptionError } from './declaration-error.ts';
import { StaleExemptionError } from './errors.ts';
import { checkReasons } from './reasons.ts';

/** The length of an empty list. */
const NONE = 0;

/** Keys a rule tolerates, each with its reason. Consulting it fails on every entry nothing matched. */
class Exemptions {
  public readonly entries: Readonly<ReadonlyMap<string, string>>;

  /**
   * A list of exemptions.
   *
   * @param {Readonly<Record<string, string>>} entries - Each tolerated key's reason, by key.
   */
  public constructor(entries: Readonly<Record<string, string>>) {
    this.entries = new Map(Object.entries(entries));
    checkReasons(this.entries);
  }

  /**
   * Build from {reason: keys}; a key listed twice is refused.
   *
   * @param {Readonly<Record<string, readonly string[]>>} groups - The keys each reason covers, by reason.
   * @returns {Exemptions} The list.
   */
  public static grouped(groups: Readonly<Record<string, readonly string[]>>): Exemptions {
    const entries = new Map<string, string>();
    for (const [reason, keys] of Object.entries(groups)) {
      for (const key of keys) {
        if (entries.has(key)) {
          throw new ExemptionError(`${JSON.stringify(key)} is exempted twice`);
        }
        entries.set(key, reason);
      }
    }
    return new Exemptions(Object.fromEntries(entries));
  }

  /**
   * The findings no entry covers; throws if an entry covers no finding.
   *
   * @param {Readonly<Iterable<string>>} found - The findings' keys.
   * @returns {string[]} The findings no entry covers.
   */
  public unexempted(found: Readonly<Iterable<string>>): string[] {
    return this.unexemptedBy(found, (finding) => finding);
  }

  /**
   * Like `unexempted`, for findings richer than the key.
   *
   * @param {Readonly<Iterable<Finding>>} findings - The findings.
   * @param {(finding: Finding) => string} key - Maps each finding to its key.
   * @returns {Finding[]} The findings no entry covers.
   */
  public unexemptedBy<Finding>(findings: Readonly<Iterable<Finding>>, key: (finding: Finding) => string): Finding[] {
    const seen = [...findings];
    const keys = new Set(seen.map((finding) => key(finding)));
    const stale = [...this.entries.keys()].filter((entry) => !keys.has(entry));
    const unexempted = seen.filter((finding) => !this.entries.has(key(finding)));
    if (stale.length > NONE) {
      const uncovered = unexempted.map((finding) => key(finding));
      throw new StaleExemptionError(
        `stale exemptions, delete them: ${JSON.stringify(stale)}; findings no entry covers: ${JSON.stringify(uncovered)}`,
      );
    }
    return unexempted;
  }
}

export { Exemptions };
