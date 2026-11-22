/**
 * A JSON file's text read as written: `JSON.parse` keeps the last of two equal keys and
 * rounds a number it cannot hold, so a file's problems are read from its tokens. The reader holds
 * RFC 8259 JSON and nothing looser: no comment, no trailing comma.
 */

import { JsonSyntaxError, tokensOf } from './json-tokens.ts';
import type { JsonToken } from './json-tokens.ts';
import { json } from './config.ts';

/** A problem a JSON text has, with where it sits as a path of keys and indices. */
interface JsonProblem {
  readonly path: string;
  readonly problem: string;
}

/** A lone UTF-16 surrogate: under the `u` flag, a paired one reads as one astral code point. */
const LONE_SURROGATE = /[\uD800-\uDFFF]/u;
/** A whole number as written. */
const INTEGER = /^-?\d+$/u;
/** A number's significand has a nonzero digit. */
const NONZERO = /^-?0*\.?0*[1-9]/u;
/** One token's step. */
const STEP = 1;
/** The last token, read from the end. */
const LAST = -1;
/** The first offset of a text, and the first index of an array. */
const START = 0;
/** The number a significand with a nonzero digit must not round to. */
const ZERO = 0;

/**
 * What is wrong with a number as written, if anything: JavaScript cannot hold it.
 *
 * @param {string} written - The number's text.
 * @returns {string | undefined} The problem, or undefined.
 */
function numberProblem(written: string): string | undefined {
  const value = Number(written);
  if (!Number.isFinite(value)) {
    return `the number ${written} is outside the range JavaScript holds`;
  }
  if (value === ZERO && NONZERO.test(written)) {
    return `the number ${written} rounds to zero`;
  }
  return INTEGER.test(written) && !Number.isSafeInteger(value) ? `the integer ${written} is outside the safe integer range` : undefined;
}

/**
 * What is wrong with a key, if anything.
 *
 * @param {string} key - The decoded key.
 * @param {ReadonlySet<string>} seen - The keys read before it in its object.
 * @returns {readonly string[]} Its problems.
 */
function keyProblems(key: string, seen: ReadonlySet<string>): readonly string[] {
  return [
    ...(key === '' ? ['the key is empty'] : []),
    ...(key.normalize('NFC') === key ? [] : ['the key is not in Unicode normal form C']),
    ...(LONE_SURROGATE.test(key) ? ['the key holds a lone surrogate'] : []),
    ...(seen.has(key) ? ['the key is written twice; JSON.parse keeps the last'] : []),
  ];
}

/** A reading of one text's tokens: where it is, and the problems it has found. */
class Reading {
  readonly #tokens: readonly JsonToken[];
  readonly #problems: JsonProblem[] = [];
  #at = START;

  public constructor(text: string) {
    this.#tokens = tokensOf(text);
  }

  /**
   * Read the whole text as one value.
   *
   * @returns {readonly JsonProblem[]} The problems it has.
   */
  public problems(): readonly JsonProblem[] {
    this.value('$');
    if (this.#at !== this.#tokens.length) {
      this.stop('the end of the text');
    }
    return this.#problems;
  }

  /**
   * Stop: the tokens are no JSON value.
   *
   * @param {string} expected - What the grammar wanted there.
   * @returns {never} Never: it throws.
   */
  private stop(expected: string): never {
    const offset = this.#tokens.at(this.#at)?.offset ?? this.#tokens.at(LAST)?.offset ?? START;
    throw new JsonSyntaxError(`expected ${expected} at offset ${String(offset)}`);
  }

  /**
   * Take the next token when it is a given mark.
   *
   * @param {string} mark - The mark.
   * @returns {boolean} Whether it was, and was taken.
   */
  private take(mark: string): boolean {
    const token = this.#tokens.at(this.#at);
    const isMark = token?.kind === 'mark' && token.text === mark;
    if (isMark) {
      this.#at += STEP;
    }
    return isMark;
  }

  /**
   * Take a mark the grammar requires, or stop.
   *
   * @param {string} mark - The mark.
   * @param {string} expected - What the grammar wanted there, for the error.
   */
  private require(mark: string, expected: string): void {
    if (!this.take(mark)) {
      this.stop(expected);
    }
  }

  /**
   * Note a problem at a path.
   *
   * @param {string} path - Where it sits.
   * @param {readonly string[]} problems - The problems.
   */
  private note(path: string, problems: readonly string[]): void {
    this.#problems.push(...problems.map((problem) => ({ path, problem })));
  }

  /**
   * Read one member's key and colon, and note what is wrong with the key.
   *
   * @param {string} path - The object's path.
   * @param {ReadonlySet<string>} seen - The keys read before it in the object.
   * @returns {string} The key.
   */
  private key(path: string, seen: ReadonlySet<string>): string {
    const token = this.#tokens.at(this.#at);
    if (token?.kind !== 'string') {
      return this.stop('a key');
    }
    this.#at += STEP;
    const key = String(json(token.text));
    this.note(`${path}.${key}`, keyProblems(key, seen));
    this.require(':', "':'");
    return key;
  }

  /**
   * Read an object's members, its opening brace taken.
   *
   * @param {string} path - The object's path.
   */
  private object(path: string): void {
    if (this.take('}')) {
      return;
    }
    const seen = new Set<string>();
    do {
      const key = this.key(path, seen);
      seen.add(key);
      this.value(`${path}.${key}`);
    } while (this.take(','));
    this.require('}', "',' or '}'");
  }

  /**
   * Read an array's elements, its opening bracket taken.
   *
   * @param {string} path - The array's path.
   */
  private array(path: string): void {
    if (this.take(']')) {
      return;
    }
    let index = START;
    do {
      this.value(`${path}[${String(index)}]`);
      index += STEP;
    } while (this.take(','));
    this.require(']', "',' or ']'");
  }

  /**
   * Note what is wrong with a scalar value, if anything.
   *
   * @param {JsonToken} token - The scalar's token.
   * @param {string} path - Where it sits.
   */
  private scalar(token: Readonly<JsonToken>, path: string): void {
    const lone = token.kind === 'string' && LONE_SURROGATE.test(String(json(token.text)));
    const problem = token.kind === 'number' ? numberProblem(token.text) : undefined;
    this.note(path, [...(lone ? ['the string holds a lone surrogate'] : []), ...(problem === undefined ? [] : [problem])]);
  }

  /**
   * Read a container a mark opens, its mark taken; any other mark is no value.
   *
   * @param {string} mark - The mark.
   * @param {string} path - Where the container sits.
   */
  private container(mark: string, path: string): void {
    switch (mark) {
      case '{': {
        this.object(path);
        break;
      }
      case '[': {
        this.array(path);
        break;
      }
      default: {
        this.#at -= STEP;
        this.stop('a value');
      }
    }
  }

  /**
   * Read one value.
   *
   * @param {string} path - Where it sits.
   */
  private value(path: string): void {
    const token = this.#tokens.at(this.#at);
    if (token === undefined) {
      this.stop('a value');
    }
    this.#at += STEP;
    if (token.kind === 'mark') {
      this.container(token.text, path);
    } else {
      this.scalar(token, path);
    }
  }
}

/**
 * The problems a JSON text has: a key written twice, empty, not normalised or holding a lone
 * surrogate; a string with a lone surrogate; a number JavaScript cannot hold as written. A text that
 * is no strict JSON (a comment, a trailing comma, a missing quote) is one problem at the root.
 *
 * @param {string} text - The file's text.
 * @returns {readonly JsonProblem[]} Its problems, in reading order.
 */
function jsonProblems(text: string): readonly JsonProblem[] {
  try {
    return new Reading(text).problems();
  } catch (error) {
    if (!(error instanceof JsonSyntaxError)) {
      throw error;
    }
    return [{ path: '$', problem: `not strict JSON: ${error.message}` }];
  }
}

export { jsonProblems };
