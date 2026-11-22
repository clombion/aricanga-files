/** Running an entry script in the test's own process, with its library function stood in for. */

import { Readable } from 'node:stream';
import { fromRoot } from '#lib/paths.ts';
import type { text } from 'node:stream/consumers';
import { vi } from 'vitest';

/** What a stood-in standard input holds: one updated ref with a known remote side. */
const STDIN = 'refs/heads/x bbbb refs/heads/x aaaa\n';

/** The exit code each stood-in function returns, distinct from success and failure. */
const STOOD_IN = 7;

/** The index of the last entry of a list. */
const LAST = -1;

/**
 * A stood-in library function: it does nothing and returns `STOOD_IN`.
 *
 * @returns {Promise<number>} `STOOD_IN`.
 */
async function stoodIn(): Promise<number> {
  const code = await Promise.resolve(STOOD_IN);
  return code;
}

/**
 * A stood-in library function that returns nothing.
 *
 * @returns {Promise<void>} Settles at once.
 */
async function settles(): Promise<void> {
  await Promise.resolve();
}

/**
 * A stand-in for `text` from `node:stream/consumers`: standard input reads as `STDIN`, and any other
 * stream is read by the real `text`.
 *
 * @param {unknown} stream - The stream read.
 * @returns {Promise<string>} Its text.
 */
async function standingIn(stream: unknown): Promise<string> {
  if (stream === process.stdin) {
    const stood = await Promise.resolve(STDIN);
    return stood;
  }
  if (!(stream instanceof Readable)) {
    throw new TypeError('a stood-in text read was handed no readable stream');
  }
  const actual = await vi.importActual<{ readonly text: typeof text }>('node:stream/consumers');
  const read = await actual.text(stream);
  return read;
}

/**
 * Run an entry script in this process and read the exit code it set, clearing it again.
 *
 * @param {string} script - The script's file name under `harness/scripts`.
 * @returns {Promise<number | string | undefined>} The exit code the script set.
 */
async function exitOf(script: string): Promise<number | string | undefined> {
  await import(fromRoot('harness/scripts', script));
  const code = process.exitCode ?? undefined;
  process.exitCode = undefined;
  return code;
}

/**
 * The argument of a stood-in function's last call.
 *
 * @param {ReadonlyArray<readonly [Argument]>} calls - The function's calls, each with its one argument.
 * @returns {Argument} The last call's argument.
 */
function lastArgument<Argument>(calls: readonly (readonly [Argument])[]): Argument {
  const last = calls.at(LAST);
  if (last === undefined) {
    throw new TypeError('the stood-in function was never called');
  }
  const [argument] = last;
  return argument;
}

export { exitOf, lastArgument, settles, standingIn, STDIN, STOOD_IN, stoodIn };
