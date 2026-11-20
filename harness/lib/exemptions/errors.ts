/** The refusal of an exemption list a check consulted and found stale. */

/** An entry no finding matched, or a count that differs from what was found. */
class StaleExemptionError extends Error {
  public override readonly name = 'StaleExemptionError';
}

export { StaleExemptionError };
