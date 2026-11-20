/** The harness's list helpers: emptiness, and a slot a hook fills and empties. */

/** The length of an empty list. */
const EMPTY = 0;

/**
 * Whether a list holds nothing.
 *
 * @param {readonly unknown[]} items - The list.
 * @returns {boolean} Whether it is empty.
 */
function isEmpty(items: readonly unknown[]): boolean {
  return items.length === EMPTY;
}

/** One value a hook puts before a test and takes after it; empty between tests. */
class Slot<Value> {
  private held: readonly Value[] = [];

  /**
   * Hold `value`, replacing what the slot held.
   *
   * @param {Value} value - The value to hold.
   */
  public put(value: Value): void {
    this.held = [value];
  }

  /**
   * Empty the slot.
   *
   * @returns {Value | undefined} What it held, or undefined.
   */
  public take(): Value | undefined {
    const [value] = this.held;
    this.held = [];
    return value;
  }

  /**
   * What the slot holds, without emptying it.
   *
   * @returns {Value | undefined} What it holds, or undefined.
   */
  public peek(): Value | undefined {
    const [value] = this.held;
    return value;
  }
}

export { isEmpty, Slot };
