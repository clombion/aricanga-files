/**
 * The one owner of exemption lists: every entry carries a reason and fails once it matches nothing.
 *
 * Four declarations cover every list a check consults:
 *
 * - `Exemptions`: keys a rule tolerates, each with its reason; an entry no finding matches fails.
 * - `CountedExemptions`: keys a rule tolerates a fixed number of times; a count off either way fails.
 * - `Accepted`: the values a rule defines as valid; consulted by membership, nothing has to match.
 * - `Prefixes`: the starts or ends text matching uses; consulted by `starts` and `ends` only.
 *
 * Keys are strings. A check keyed by a pair builds its key with `site(path, rule)`. No declaration
 * hands its keys to a consumer: a check that needs the keys derives them from its own scan, and the
 * list holds their liveness.
 */

export class StaleExemptionError extends Error {
  override readonly name = 'StaleExemptionError';
}

export class ExemptionError extends Error {
  override readonly name = 'ExemptionError';
}

/** The key of a (path, rule) finding. */
export function site(path: string, rule: string): string {
  return `${path} :: ${rule}`;
}

function checkReasons(reasons: Iterable<readonly [string, string]>): void {
  const blank = [...reasons].filter(([, reason]) => reason.trim() === '').map(([key]) => key);
  if (blank.length > 0) {
    throw new ExemptionError(`exemptions without a reason: ${JSON.stringify(blank)}`);
  }
}

/** Keys a rule tolerates, each with its reason. Consulting it fails on every entry nothing matched. */
export class Exemptions {
  readonly entries: ReadonlyMap<string, string>;

  constructor(entries: Readonly<Record<string, string>>) {
    this.entries = new Map(Object.entries(entries));
    checkReasons(this.entries);
  }

  /** Build from {reason: keys}; a key listed twice is refused. */
  static grouped(groups: Readonly<Record<string, readonly string[]>>): Exemptions {
    const entries: Record<string, string> = {};
    for (const [reason, keys] of Object.entries(groups)) {
      for (const key of keys) {
        if (Object.hasOwn(entries, key)) {
          throw new ExemptionError(`${JSON.stringify(key)} is exempted twice`);
        }
        entries[key] = reason;
      }
    }
    return new Exemptions(entries);
  }

  /** Return the findings no entry covers; throw if an entry covers no finding. */
  unexempted(found: Iterable<string>): string[] {
    return this.unexemptedBy(found, (finding) => finding);
  }

  /** Like `unexempted`, for findings richer than the key: `key` maps each finding to its key. */
  unexemptedBy<F>(findings: Iterable<F>, key: (finding: F) => string): F[] {
    const seen = [...findings];
    const keys = new Set(seen.map(key));
    const stale = [...this.entries.keys()].filter((entry) => !keys.has(entry));
    if (stale.length > 0) {
      throw new StaleExemptionError(`stale exemptions, delete them: ${JSON.stringify(stale)}`);
    }
    return seen.filter((finding) => !this.entries.has(key(finding)));
  }
}

/** A key whose found count differs from its registered count. */
export interface Mismatch {
  readonly key: string;
  readonly found: number;
  readonly registered: number;
}

/** Keys a rule tolerates a fixed number of times; a count that differs either way fails. */
export class CountedExemptions {
  readonly entries: ReadonlyMap<string, readonly [number, string]>;

  constructor(entries: Readonly<Record<string, readonly [number, string]>>) {
    this.entries = new Map(Object.entries(entries));
    checkReasons([...this.entries].map(([key, [, reason]]) => [key, reason] as const));
    const low = [...this.entries].filter(([, [count]]) => count < 1).map(([key]) => key);
    if (low.length > 0) {
      throw new ExemptionError(`counted exemptions below one: ${JSON.stringify(low)}`);
    }
  }

  /** Every key whose found count differs from its entry, sorted by key. */
  mismatches(found: Iterable<string>): Mismatch[] {
    const counts = new Map<string, number>();
    for (const key of found) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const keys = new Set([...counts.keys(), ...this.entries.keys()]);
    return [...keys]
      .toSorted()
      .map((key) => ({ key, found: counts.get(key) ?? 0, registered: this.entries.get(key)?.[0] ?? 0 }))
      .filter((mismatch) => mismatch.found !== mismatch.registered);
  }

  /** Fail on a key found more often than registered (a new violation) or less (a stale count). */
  assertExact(found: Iterable<string>): void {
    const mismatches = this.mismatches(found);
    if (mismatches.length > 0) {
      throw new StaleExemptionError(
        `counts differ from their entries (key, found, registered): ${JSON.stringify(mismatches)}`,
      );
    }
  }
}

/** The values a rule defines as valid, such as exit codes or file suffixes. */
export class Accepted<T extends string | number> {
  readonly values: ReadonlySet<T>;

  constructor(values: Iterable<T>) {
    this.values = new Set(values);
  }

  /** Whether `value` is one of the accepted values; any value may be asked about. */
  has(value: unknown): boolean {
    const values: ReadonlySet<unknown> = this.values;
    return values.has(value);
  }

  [Symbol.iterator](): Iterator<T> {
    return [...this.values].toSorted().values();
  }
}

/** The starts or ends that text matching uses. */
export class Prefixes {
  readonly values: readonly string[];

  constructor(values: readonly string[]) {
    this.values = values;
  }

  /** Whether `text` starts with one of the values. */
  starts(text: string): boolean {
    return this.values.some((value) => text.startsWith(value));
  }

  /** Whether `text` ends with one of the values. */
  ends(text: string): boolean {
    return this.values.some((value) => text.endsWith(value));
  }
}
