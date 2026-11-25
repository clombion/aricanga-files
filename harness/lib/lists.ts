/** The harness's list helpers: emptiness, the order of written text, and a slot a hook fills and empties. */

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

/**
 * Apply `step` to what `iterator` has left, one item after another.
 *
 * @param {Iterator<Item>} iterator - The items left.
 * @param {(item: Item) => Promise<Result>} step - The work for one item.
 * @param {readonly Result[]} done - The results so far.
 * @returns {Promise<readonly Result[]>} Every result, in order.
 */
async function drain<Item, Result>(
  iterator: Iterator<Item>,
  step: (item: Item) => Promise<Result>,
  done: readonly Result[],
): Promise<readonly Result[]> {
  const next = iterator.next();
  if (next.done === true) {
    return done;
  }
  const result = await step(next.value);
  const all = await drain(iterator, step, [...done, result]);
  return all;
}

/**
 * Apply `step` to each item one after another, never two at once, keeping the items' order: for
 * work that must not overlap, such as builds that each watch the checkout for writes.
 *
 * @param {readonly Item[]} items - The items.
 * @param {(item: Item) => Promise<Result>} step - The work for one item.
 * @returns {Promise<readonly Result[]>} Each item's result, in order.
 */
async function inSequence<Item, Result>(items: readonly Item[], step: (item: Item) => Promise<Result>): Promise<readonly Result[]> {
  const results = await drain(items.values(), step, []);
  return results;
}

/**
 * The items a test holds, and the rest, in one pass: two lists disjoint and exhaustive by construction.
 *
 * @param {readonly Item[]} items - The items.
 * @param {(item: Item) => boolean} test - The test.
 * @returns {readonly [readonly Item[], readonly Item[]]} The items it holds, then the others, each in the items' order.
 */
function partitioned<Item>(items: readonly Item[], test: (item: Item) => boolean): readonly [readonly Item[], readonly Item[]] {
  const held: Item[] = [];
  const rest: Item[] = [];
  for (const item of items) {
    (test(item) ? held : rest).push(item);
  }
  return [held, rest];
}

/**
 * Items grouped by a key, each group in the items' order; an item with no key is in no group. Keys
 * are compared as a `Map` compares them: an object by its identity.
 *
 * @param {readonly Item[]} items - The items.
 * @param {(item: Item) => Key | undefined} keyOf - Each item's key, or none.
 * @returns {ReadonlyMap<Key, readonly Item[]>} The groups, by key.
 */
function groupedBy<Item, Key>(items: readonly Item[], keyOf: (item: Item) => Key | undefined): ReadonlyMap<Key, readonly Item[]> {
  const groups = new Map<Key, Item[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = key === undefined ? undefined : groups.get(key);
    if (group !== undefined) {
      group.push(item);
    } else if (key !== undefined) {
      groups.set(key, [item]);
    }
  }
  return groups;
}

export { groupedBy, inSequence, isEmpty, partitioned, Slot };
export { byCodeUnit } from './exemptions/order.ts';
