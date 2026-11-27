/** Running an entry script in the test's own process, with its library function stood in for. */

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
 * A stood-in standard input: it reads nothing and gives `STDIN`.
 *
 * @returns {Promise<string>} `STDIN`.
 */
async function stoodInput(): Promise<string> {
  const stood = await Promise.resolve(STDIN);
  return stood;
}

/**
 * A module with one of its functions stood in for by `stoodIn`, every other export as it is.
 *
 * @param {Module} module - The module's real exports.
 * @param {keyof Module} name - The function to stand in for.
 * @returns {Module} The exports with that function stood in for.
 */
function withStoodIn<Module extends object>(module: Readonly<Module>, name: keyof Module): Module {
  return { ...module, [name]: vi.fn<() => Promise<number>>(stoodIn) };
}

/**
 * Run an entry script in this process and read the exit code it set, clearing it again.
 *
 * @param {Promise<unknown>} script - The script loading: its `import()`, written by the test.
 * @returns {Promise<number | string | undefined>} The exit code the script set.
 */
async function exitOf(script: Promise<unknown>): Promise<number | string | undefined> {
  await script;
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

export { exitOf, lastArgument, STDIN, STOOD_IN, stoodIn, stoodInput, withStoodIn };
