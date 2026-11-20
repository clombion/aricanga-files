/*
 * The readers a system parses its inbound values with: a player command and a restored state arrive
 * untyped, and each system turns them into its own closed types or refuses them, naming the value
 * and itself (ADR-0007). Every reader refuses through the one error, so a refusal reads alike
 * whichever system or field made it.
 */

import type { Command } from './input';

/** An inbound value a system does not accept as one of its own. */
class InputRefusedError extends Error {
  public override readonly name = 'InputRefusedError';
}

/** A function turning one untyped entry into a typed one; `at` names where the entry sits. */
type Item<TValue> = (entry: unknown, at: string) => TValue;

/**
 * The readers one system parses with, each refusing in that system's name: what `readerOf` hands a
 * system author, who names it when passing the readers to a helper of their own.
 *
 * @public
 */
interface Reader {
  /** Refuse a value, naming what was expected and the value. */
  readonly refuse: (what: string, value: unknown) => never;
  /** An object, read as its own fields. */
  readonly object: (value: unknown, what: string) => Readonly<Record<string, unknown>>;
  readonly string: (value: unknown, what: string) => string;
  /** A finite number. */
  readonly number: (value: unknown, what: string) => number;
  readonly boolean: (value: unknown, what: string) => boolean;
  /** Refuse a value that is present where nothing belongs, such as a payload a command carries none of. */
  readonly absent: (value: unknown, what: string) => void;
  /** A list, each entry read by `item`. */
  readonly list: <TValue>(value: unknown, what: string, item: Item<TValue>) => readonly TValue[];
  /** A record keyed by string, each value read by `item`. */
  readonly record: <TValue>(value: unknown, what: string, item: Item<TValue>) => Readonly<Record<string, TValue>>;
}

/**
 * A value as a refusal shows it: its JSON text, or its type when it has none.
 *
 * @param {unknown} value - The refused value.
 * @returns {string} The value's text.
 */
function shown(value: unknown): string {
  const json: unknown = JSON.stringify(value);
  return typeof json === 'string' ? json : typeof value;
}

/**
 * Whether a value is a plain object, not `null` and not a list.
 *
 * @param {unknown} value - The value to inspect.
 * @returns {boolean} Whether it is an object whose fields can be read.
 */
function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The readers of one system.
 *
 * @param {string} systemId - The system the readers refuse in the name of.
 * @returns {Reader} Its readers.
 */
function readerOf(systemId: string): Reader {
  const refuse = (what: string, value: unknown): never => {
    throw new InputRefusedError(`system "${systemId}" refuses ${what}: ${shown(value)}`);
  };
  const object = (value: unknown, what: string): Readonly<Record<string, unknown>> => (isObject(value) ? value : refuse(what, value));
  return {
    absent: (value, what) => {
      if (value !== undefined) {
        refuse(what, value);
      }
    },
    boolean: (value, what) => (typeof value === 'boolean' ? value : refuse(what, value)),
    list: <TValue>(value: unknown, what: string, item: Item<TValue>): readonly TValue[] =>
      Array.isArray(value) ? value.map((entry: unknown, index) => item(entry, `${what}[${String(index)}]`)) : refuse(what, value),
    number: (value, what) => (typeof value === 'number' && Number.isFinite(value) ? value : refuse(what, value)),
    object,
    record: <TValue>(value: unknown, what: string, item: Item<TValue>): Readonly<Record<string, TValue>> => {
      const fields = object(value, what);
      return Object.fromEntries(Object.keys(fields).map((key) => [key, item(fields[key], `${what}.${key}`)]));
    },
    refuse,
    string: (value, what) => (typeof value === 'string' ? value : refuse(what, value)),
  };
}

/**
 * A command's kind, one of `kinds`, with its payload unread; any other value is refused.
 *
 * @param {Reader} read - The system's readers.
 * @param {unknown} value - The inbound value.
 * @param {readonly string[]} kinds - The kinds the system accepts.
 * @returns {Command} The command's kind and its payload, for the system to read.
 */
function commandOf<TKind extends string>(read: Readonly<Reader>, value: unknown, kinds: readonly TKind[]): Command<TKind> {
  const command = read.object(value, 'a command');
  const kind = kinds.find((known) => known === command['kind']);
  return kind === undefined ? read.refuse('a command', value) : { kind, payload: command['payload'] };
}

/**
 * The parser of a command union whose commands carry no payload.
 *
 * @param {string} systemId - The system the commands are for.
 * @param {readonly string[]} kinds - The command kinds.
 * @returns {Function} The parser: one of the commands, or refused.
 */
function unitCommands<TKind extends string>(systemId: string, kinds: readonly TKind[]): (value: unknown) => Command<TKind, undefined> {
  const read = readerOf(systemId);
  return (value) => {
    const command = commandOf(read, value, kinds);
    read.absent(command.payload, `the ${command.kind} payload`);
    return { kind: command.kind, payload: undefined };
  };
}

export { commandOf, InputRefusedError, readerOf, unitCommands };
export type { Item, Reader };
