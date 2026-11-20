/** The refusal of a tool run that could not start or outlived its bound. */

/** A tool run that did not finish. */
class ToolError extends Error {
  public override readonly name = 'ToolError';
}

export { ToolError };
