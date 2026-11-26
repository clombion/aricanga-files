/**
 * A reader of a closed tagged union by its `kind`: an arm per kind, each taking a value of its own
 * kind, so `tsc` refuses a reader missing an arm, and every reader once the union gains a kind. It is
 * the handler table typed over a closed union that the testing strategy names for total handling, in
 * place of a switch with a `never` default: that arm is reached by no value, so the coverage floor
 * would hold it only through a counted coverage suppression at every reader.
 */

/** One arm per kind of a closed tagged union, each taking a value of its own kind. */
type Arms<Union extends Readonly<{ kind: string }>, Result> = {
  readonly [Kind in Union['kind']]: (value: Extract<Union, Readonly<{ kind: Kind }>>) => Result;
};

/**
 * The answer of the arm of a value's own kind.
 *
 * @param {Union} value - The value.
 * @param {Arms<Union, Result>} arms - An arm per kind of its union.
 * @returns {Result} The answer of its kind's arm.
 */
function byKind<Union extends Readonly<{ kind: string }>, Kind extends Union['kind'], Result>(
  value: Extract<Union, Readonly<{ kind: Kind }>> & Readonly<{ kind: Kind }>,
  arms: Arms<Union, Result>,
): Result {
  const arm: Arms<Union, Result>[Kind] = arms[value.kind];
  return arm(value);
}

export { byKind };
