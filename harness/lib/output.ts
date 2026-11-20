/** The one module of the harness's scripts that writes to the standard streams. A script ends through `exitCode`. */

import type { Writable } from 'node:stream';

/** The exit code of a run that found nothing wrong. */
const EXIT_SUCCESS = 0;

/** The exit code of a run that found a problem. */
const EXIT_FAILURE = 1;

/** Where a script writes: standard output or standard error, or a stand-in a test reads. */
type Sink = Readonly<Pick<Writable, 'write'>>;

/**
 * Write a script's result to standard output, as given.
 *
 * @param {string} text - The text to write.
 * @param {Sink} sink - Where it goes: standard output unless a test passes its own.
 */
function out(text: string, sink: Sink = process.stdout): void {
  sink.write(text);
}

/**
 * Write why a script failed to standard error, as given.
 *
 * @param {string} text - The text to write.
 * @param {Sink} sink - Where it goes: standard error unless a test passes its own.
 */
function err(text: string, sink: Sink = process.stderr): void {
  sink.write(text);
}

/**
 * Say a line of a script's result on standard output.
 *
 * @param {string} text - The line, without its newline.
 * @param {Sink} sink - Where it goes: standard output unless a test passes its own.
 */
function say(text: string, sink: Sink = process.stdout): void {
  out(`${text}\n`, sink);
}

/**
 * Say why a script failed on standard error, as a line.
 *
 * @param {string} text - The line, without its newline.
 * @param {Sink} sink - Where it goes: standard error unless a test passes its own.
 */
function complain(text: string, sink: Sink = process.stderr): void {
  err(`${text}\n`, sink);
}

/**
 * The exit code of a run.
 *
 * @param {boolean} passed - Whether the run found nothing wrong.
 * @returns {number} `EXIT_SUCCESS` when it passed, `EXIT_FAILURE` when it did not.
 */
function exitCode(passed: boolean): number {
  return passed ? EXIT_SUCCESS : EXIT_FAILURE;
}

/**
 * Whether a finished process exited cleanly.
 *
 * @param {Readonly<{ status: number | null }>} outcome - The finished process.
 * @returns {boolean} Whether its status is `EXIT_SUCCESS`.
 */
function succeeded(outcome: Readonly<{ status: number | null }>): boolean {
  return outcome.status === EXIT_SUCCESS;
}

export { complain, EXIT_FAILURE, EXIT_SUCCESS, err, exitCode, out, say, succeeded };
export type { Sink };
