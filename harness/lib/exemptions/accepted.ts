/** `Accepted`: the values a rule defines as valid; consulted by membership, nothing has to match. */

/** The values a rule defines as valid, such as exit codes or file suffixes. */
class Accepted<Value extends string | number> {
  public readonly values: ReadonlySet<Value>;

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
   * The accepted values, sorted.
   *
   * @returns {Iterator<Value>} The values in sorted order.
   */
  public [Symbol.iterator](): Iterator<Value> {
    return [...this.values].toSorted((left, right) => String(left).localeCompare(String(right))).values();
  }
}

export { Accepted };
