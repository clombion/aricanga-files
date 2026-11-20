/**
 * The one way the harness replaces a platform function for the length of a test: by key, through
 * `Reflect`, so a guard wraps the real function without asserting a type onto its replacement.
 */

/** A call of a function with its `this` and its arguments. */
type Call = (self: unknown, args: readonly unknown[]) => unknown;

/**
 * Replace `target[key]` with `wrap(real)`, where `real` calls the function it replaces.
 *
 * @param {object} target - The object whose function is replaced.
 * @param {string} key - The name of the function on `target`.
 * @param {(real: Call) => Call} wrap - Builds the replacement from the real function.
 * @returns {() => void} A function that puts the real one back.
 */
function patch(target: object, key: string, wrap: (real: Call) => Call): () => void {
  const real: unknown = Reflect.get(target, key);
  if (typeof real !== 'function') {
    throw new TypeError(`${key} is not a function`);
  }
  const callReal: Call = (self, args) => {
    const result: unknown = Reflect.apply(real, self, [...args]);
    return result;
  };
  const replacement = wrap(callReal);
  Reflect.set(target, key, function patched(this: unknown, ...args: readonly unknown[]): unknown {
    return replacement(this, args);
  });
  return () => {
    Reflect.set(target, key, real);
  };
}

export { patch };
