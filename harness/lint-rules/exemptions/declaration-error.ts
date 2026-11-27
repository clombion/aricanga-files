/**
 * The refusal of a declaration built wrongly: an exemption entry without a reason, twice, or below one;
 * a vocabulary fact that is no plain data.
 */

/** A declaration that cannot be built as written. */
class ExemptionError extends Error {
  public override readonly name = 'ExemptionError';
}

export { ExemptionError };
