/*
 * The one reader of chat's records keyed by chat id. A chat id is a word the story writes, so it can
 * be any string, `toString` and `constructor` among them: a record is read through its own entries
 * only, never through its prototype.
 */

/**
 * The entry a record holds under a key, if the record itself holds one.
 *
 * @param {Readonly<Record<string, TValue>>} record - A record keyed by chat id.
 * @param {string} key - The chat id.
 * @returns {TValue | undefined} The record's own entry, or undefined when it holds none.
 */
function entryOf<TValue>(record: Readonly<Record<string, TValue>>, key: string): TValue | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/**
 * Whether a record itself holds an entry under a key.
 *
 * @param {Readonly<Record<string, unknown>>} record - A record keyed by chat id.
 * @param {string} key - The chat id.
 * @returns {boolean} Whether the entry is the record's own.
 */
function holds(record: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.hasOwn(record, key);
}

export { entryOf, holds };
