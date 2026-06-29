// Compile-time exhaustiveness guard (ADR-0007). Reached only in the `default`
// branch of a switch over a closed union: if every case is handled, `value` is
// `never` and this compiles; if a case is missed, `value` is still inhabited and
// the call fails to compile. A new boundary crossing cannot be ignored.
export function assertNever(value: never): never {
  throw new Error(`Unreachable: unhandled case ${JSON.stringify(value)}`);
}
