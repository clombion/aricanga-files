/**
 * `Accepted`: the values a rule accepts as valid, which it defines or which its value type takes from
 * another owner's declarations; consulted by membership, nothing has to match.
 */

import { byCodeUnit } from './order.ts';

/** The values a rule accepts as valid, such as exit codes, file suffixes or an installed package's export names. */
class Accepted<Value extends string | number> {
  public readonly values: Readonly<ReadonlySet<Value>>;

  /**
   * The accepted values.
   *
   * @param {Readonly<Iterable<Value>>} values - The values.
   */
  public constructor(values: Readonly<Iterable<Value>>) {
    this.values = new Set(values);
  }

  /**
   * Whether `value` is one of the accepted values; any value may be asked about.
   *
   * @param {unknown} value - The value asked about.
   * @returns {boolean} Whether it is accepted.
   */
  public has(value: unknown): boolean {
    const values: ReadonlySet<unknown> = this.values;
    return values.has(value);
  }

  /**
   * The accepted values, by the code units of their text (`byCodeUnit`).
   *
   * @returns {Iterator<Value>} The values in sorted order.
   */
  public [Symbol.iterator](): Iterator<Value> {
    return [...this.values].toSorted((left, right) => byCodeUnit(String(left), String(right))).values();
  }
}

export { Accepted };
