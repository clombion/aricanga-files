/** `Prefixes`: the starts or ends text matching uses; consulted by `starts` and `ends` only. */

/** The starts or ends that text matching uses. */
class Prefixes {
  public readonly values: readonly string[];

  /**
   * The starts or ends.
   *
   * @param {readonly string[]} values - The values.
   */
  public constructor(values: readonly string[]) {
    this.values = values;
  }

  /**
   * Whether `text` starts with one of the values.
   *
   * @param {string} text - The text.
   * @returns {boolean} Whether it starts with a value.
   */
  public starts(text: string): boolean {
    return this.values.some((value) => text.startsWith(value));
  }

  /**
   * Whether `text` ends with one of the values.
   *
   * @param {string} text - The text.
   * @returns {boolean} Whether it ends with a value.
   */
  public ends(text: string): boolean {
    return this.values.some((value) => text.endsWith(value));
  }
}

export { Prefixes };
