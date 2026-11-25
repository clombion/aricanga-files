/** The indentation of a golden's JSON text. */
const INDENT = 2;

/** A comparator's answers: the left first, the right first (one object's keys are never equal). */
const LEFT_FIRST = -1;
const RIGHT_FIRST = 1;

/**
 * Order a key–value pair by its key's UTF-16 code units, the same under every locale. A JSON object
 * lists integer-like keys (`'9'`, `'10'`) first, ascending, whatever order its entries are written
 * in, so a golden holds them first and the other keys after, in this order.
 *
 * @param {readonly [string, unknown]} left - One entry, its key first.
 * @param {readonly [string, unknown]} right - The other entry.
 * @returns {number} The entries' order, by key.
 */
function byKey([left]: readonly [string, unknown], [right]: readonly [string, unknown]): number {
  return left < right ? LEFT_FIRST : RIGHT_FIRST;
}

/*
 * Canonical serialization for goldens (testing-strategy.md): deep sorted keys (integer-like keys
 * first, ascending, as every JSON object lists them; the others by code unit) so
 * the diff is stable across reducer changes that don't change behaviour, and a
 * field whose value is `undefined` (e.g. an empty `Command.payload` or `fx.persist`)
 * is left out, so a present-but-undefined field and an absent one read the same.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => canonicalize(item));
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, field]: readonly [string, unknown]) => field !== undefined)
      .toSorted(byKey);
    return Object.fromEntries(entries.map(([key, field]: readonly [string, unknown]) => [key, canonicalize(field)]));
  }
  return value;
}

/**
 * Serialize to a canonical, sorted-key JSON string for golden snapshots.
 *
 * @param {unknown} value - The value to serialize.
 * @returns {string} Its canonical JSON text.
 */
function canonical(value: unknown): string {
  return JSON.stringify(canonicalize(value), undefined, INDENT);
}

export { canonical };
