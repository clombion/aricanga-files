/** The refusal of an exemption list declared wrongly: an entry without a reason, twice, or below one. */

/** An exemption list that cannot be built as written. */
class ExemptionError extends Error {
  public override readonly name = 'ExemptionError';
}

export { ExemptionError };
