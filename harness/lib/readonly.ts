/** A deeply readonly view of a type the harness reads but does not own, such as a TypeScript syntax node or a tool's configuration. */

/** `Value` with every property, at every depth, readonly; functions are kept as they are, and a pattern is `Readonly<RegExp>`. */
type DeepReadonly<Value> = Value extends (...args: readonly never[]) => unknown
  ? Value
  : Value extends RegExp
    ? Readonly<RegExp>
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value;

export type { DeepReadonly };
