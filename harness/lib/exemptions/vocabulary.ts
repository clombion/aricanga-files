/** `Vocabulary`: the words of a closed vocabulary, each with its facts; consulted by `has`, read by `of`. */

import { ExemptionError } from './declaration-error.ts';

/**
 * `true` when a value is plain data at every depth: a string, number, boolean or null, or a list or
 * record of plain data keyed by strings. A function, a `Map` or `Set`, a class instance with methods,
 * `undefined` and a symbol key are not. `tsc` reads an accessor as a property, so a class instance
 * whose members are accessors, or a record holding a getter, passes this type; the constructor refuses
 * it (`partsOf`), since its freeze would not reach what the accessor returns.
 */
type IsFact<Value> = Value extends string | number | boolean | null
  ? true
  : Value extends (...args: never) => unknown
    ? false
    : Value extends readonly unknown[]
      ? false extends IsFact<Value[number]>
        ? false
        : true
      : Value extends object
        ? [Extract<keyof Value, symbol>] extends [never]
          ? false extends { [Key in keyof Value]-?: IsFact<Value[Key]> }[keyof Value]
            ? false
            : true
          : false
        : false;

/** The keys of `Words` a record of no words satisfies: an index signature, a pattern key or an optional word. */
type OpenKeys<Words> = { [Word in keyof Words]-?: Record<string, never> extends Pick<Words, Word> ? Word : never }[keyof Words];

/**
 * `Words` when its keys are a closed set of words, each required, and each fact is plain data;
 * `never` when any string, a pattern of strings or an optional word is a key, so `of` never types an
 * absent word's facts as present, or when a fact is no plain data (`IsFact`).
 */
type Closed<Words> = [OpenKeys<Words>] extends [never]
  ? false extends { [Word in keyof Words]-?: IsFact<Words[Word]> }[keyof Words]
    ? never
    : Words
  : never;

/** The refusal of a fact the freeze cannot reach. */
const NO_PLAIN_DATA = "a vocabulary's fact is no plain data";

/**
 * The values an object holds, under every own key, a string or a symbol, enumerable or not, so the
 * fields the refusal reads are the fields the freeze walks. An object that is no plain data at its
 * own level is refused: one whose prototype is not `Object`'s, `null` or `Array`'s (a class
 * instance), or that holds an accessor, since its freeze would not reach what the accessor returns.
 *
 * @param {object} part - The object.
 * @returns {readonly unknown[]} Its fields' values.
 */
function fieldsOf(part: Readonly<object>): readonly unknown[] {
  const prototype: unknown = Object.getPrototypeOf(part);
  if (prototype !== Object.prototype && prototype !== null && prototype !== Array.prototype) {
    throw new ExemptionError(`${NO_PLAIN_DATA}: a class instance`);
  }
  return Reflect.ownKeys(part).map((key) => {
    const field = Reflect.getOwnPropertyDescriptor(part, key);
    if (field === undefined || !Object.hasOwn(field, 'value')) {
      throw new ExemptionError(`${NO_PLAIN_DATA}: an accessor`);
    }
    const value: unknown = field.value;
    return value;
  });
}

/**
 * Every object and array reachable from the facts, each once, so a cycle ends; a function, or a part
 * that is no plain data (`fieldsOf`), is refused. The walk reads a list of values it appends each
 * part's fields to, so a deep chain does not grow the call stack, and gathers each part once, so it
 * is linear in the parts and their fields.
 *
 * @param {unknown} facts - The facts.
 * @returns {ReadonlySet<object>} Every part.
 */
function partsOf(facts: unknown): ReadonlySet<object> {
  const parts = new Set<object>();
  const values: unknown[] = [facts];
  // An array's iterator reads its length at every step, so it reaches each value pushed while it runs.
  for (const value of values) {
    if (typeof value === 'function') {
      throw new ExemptionError(`${NO_PLAIN_DATA}: a function`);
    }
    if (typeof value === 'object' && value !== null && !parts.has(value)) {
      parts.add(value);
      for (const field of fieldsOf(value)) {
        values.push(field);
      }
    }
  }
  return parts;
}

/**
 * A closed vocabulary: each word declared once, as a key, with its facts; nothing has to match. It
 * freezes the record it is given through every fact, a cycle included, and refuses a fact that is no
 * plain data, so neither a later write to that record nor a write to a fact it hands out can change
 * anything here. One fact is beyond it: a `Proxy` whose traps answer a plain prototype and plain
 * fields reads as plain data, and no check at run time can tell a proxy apart, so a fact built over
 * one may change after construction.
 */
class Vocabulary<const Words extends Readonly<Record<string, unknown>>> {
  readonly #facts: Words;

  /**
   * The words, frozen, in the record's own key order: words that read as array indices (`'2'`,
   * `'10'`) first, ascending, then the others in the order they are declared.
   */
  public readonly words: readonly (keyof Words & string)[];

  /**
   * The vocabulary's words with their facts.
   *
   * @param {Closed<Words>} facts - Each word's facts, by word; a record any string is a key of is refused.
   */
  public constructor(facts: Closed<Words>) {
    for (const part of partsOf(facts)) {
      Object.freeze(part);
    }
    this.#facts = facts;
    this.words = Object.freeze(Object.keys(this.#facts).filter((word) => this.has(word)));
  }

  /**
   * Whether `word` is one of the vocabulary's words; any value may be asked about.
   *
   * @param {unknown} word - The value asked about.
   * @returns {boolean} Whether it is a word.
   */
  public has(word: unknown): word is keyof Words & string {
    return typeof word === 'string' && Object.hasOwn(this.#facts, word);
  }

  /**
   * The facts of a word.
   *
   * @param {Word} word - The word.
   * @returns {Words[Word]} Its facts.
   */
  public of<Word extends keyof Words & string>(word: Word): Words[Word] {
    return this.#facts[word];
  }
}

export { Vocabulary };
