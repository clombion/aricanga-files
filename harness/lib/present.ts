/** A value the harness relies on where a library's types allow it to be absent: the one place such an absence is refused. */

/** A value a library's types allow to be absent turned out absent where the harness relies on it. */
class AbsentError extends Error {
  public override readonly name = 'AbsentError';
}

/**
 * A value the harness relies on, where a library's types allow it to be absent, refusing its
 * absence by naming what was missing.
 *
 * @param {Value | undefined} value - The value.
 * @param {string} what - What the value is, for the refusal.
 * @returns {Value} The value.
 */
function present<Value>(value: Value | undefined, what: string): Value {
  if (value === undefined) {
    throw new AbsentError(`${what} is absent`);
  }
  return value;
}

export { AbsentError, present };
