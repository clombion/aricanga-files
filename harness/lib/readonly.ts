/**
 * Views of a type the harness reads but does not own, such as a TypeScript syntax node or a tool's
 * configuration: deeply readonly, and narrowed to some of its fields.
 */

/** `Value` with every property, at every depth, readonly; functions are kept as they are, and a pattern is `Readonly<RegExp>`. */
type DeepReadonly<Value> = Value extends (...args: readonly never[]) => unknown
  ? Value
  : Value extends RegExp
    ? Readonly<RegExp>
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value;

/** The fields of `Type` beside `Keys`, each refused: a value holding one, written or spread, does not compile. */
type NoOther<Type, Keys extends keyof Type> = Readonly<Partial<Record<Exclude<keyof Type, Keys>, never>>>;

export type { DeepReadonly, NoOther };
