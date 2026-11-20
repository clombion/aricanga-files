/** Counted exemptions written as `{ count, reason }`, so a count is named where it is declared. */

/** A counted entry's count and reason. */
interface Counted {
  readonly count: number;
  readonly reason: string;
}

/**
 * The entries of a `CountedExemptions`, from each key's count and reason.
 *
 * @param {Readonly<Record<string, Counted>>} entries - Each key's count and reason.
 * @returns {Readonly<Record<string, readonly [number, string]>>} The entries as `[count, reason]`.
 */
function counted(entries: Readonly<Record<string, Counted>>): Readonly<Record<string, readonly [number, string]>> {
  return Object.fromEntries(Object.entries(entries).map(([key, entry]: readonly [string, Counted]) => [key, [entry.count, entry.reason] as const]));
}

export { counted };
