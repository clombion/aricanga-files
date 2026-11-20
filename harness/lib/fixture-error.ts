/** The refusal of a lint-rule fixture named or written wrongly, or a planted run that gave no report. */

/** A fixture the planted lint run cannot use. */
class FixtureError extends Error {
  public override readonly name = 'FixtureError';
}

export { FixtureError };
