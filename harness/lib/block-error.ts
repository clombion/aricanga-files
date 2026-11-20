/** The refusal of a generated-block marker without its pair. */

/** A generated block of a doc that is not closed, or a marker that closes none. */
class BlockError extends Error {
  public override readonly name = 'BlockError';
}

export { BlockError };
