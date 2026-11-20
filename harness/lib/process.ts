/**
 * The one owner of starting a child process. Every run is bounded, and its outcome is one of
 * three: it finished, it outlived its bound, or it could not start.
 */

import type { Writable } from 'node:stream';
import { env } from 'node:process';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { text } from 'node:stream/consumers';

/** A run that ended on its own, with its status and its output. */
interface Finished {
  readonly kind: 'finished';
  readonly argv: readonly string[];
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** A run killed at its bound. */
interface TimedOut {
  readonly kind: 'timed-out';
  readonly argv: readonly string[];
  readonly timeoutMs: number;
}

/** A run that could not start. */
interface NotStarted {
  readonly kind: 'not-started';
  readonly argv: readonly string[];
  readonly reason: string;
}

/** How a run ended. */
type Outcome = Finished | TimedOut | NotStarted;

/** Where a run starts, its bound, and what it reads. */
interface RunOptions {
  readonly timeoutMs: number;
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly input?: string;
}

/**
 * This process's environment: the one read of `process.env` in the harness.
 *
 * @returns {Record<string, string>} Each set variable, by name.
 */
function environment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).flatMap(([name, value]: readonly [string, string | undefined]) =>
      value === undefined ? [] : [[name, value]],
    ),
  );
}

/**
 * The status a closed child process reported: its exit code, or undefined when a signal ended it.
 *
 * @param {readonly unknown[]} closed - The arguments of the child's `close` event.
 * @returns {number | undefined} The exit code, or undefined.
 */
function statusOf(closed: readonly unknown[]): number | undefined {
  const [status] = closed;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Give a child its input, if it has any, and close its standard input. A child that ends without
 * reading what it was given leaves the pipe failing (EPIPE): such a run could not be given what it
 * reads, and counts as not started, as a synchronous run reports it.
 *
 * @param {Readonly<Pick<Writable, 'end' | 'on'>>} stdin - The child's standard input.
 * @param {string | undefined} input - What the child reads, if anything.
 * @returns {{ failure?: string }} Holds the pipe's failure, once there is one.
 */
function feed(stdin: Readonly<Pick<Writable, 'end' | 'on'>>, input: string | undefined): { failure?: string } {
  const piped: { failure?: string } = {};
  stdin.on('error', (error: Readonly<Error>) => {
    piped.failure = error.message;
  });
  if (input === undefined) {
    stdin.end();
  } else {
    stdin.end(input);
  }
  return piped;
}

/** What a closed child left: its `close` event's arguments, its standard output and its standard error. */
type Closed = readonly [readonly unknown[], string, string];

/**
 * Wait for a started child to close.
 *
 * @param {readonly string[]} argv - The command and its arguments.
 * @param {Readonly<AbortSignal>} bound - The signal that kills the child at its bound.
 * @param {Readonly<Promise<Closed>>} closing - Settles when the child closed and its output was read.
 * @returns {Promise<Outcome | undefined>} How it ended, or undefined if it outlived its bound.
 */
async function closeOf(
  argv: readonly string[],
  bound: Readonly<AbortSignal>,
  closing: Readonly<Promise<Closed>>,
): Promise<Outcome | undefined> {
  try {
    const [closed, stdout, stderr] = await closing;
    const status = statusOf(closed);
    return bound.aborted || status === undefined ? undefined : { argv, kind: 'finished', status, stderr, stdout };
  } catch (error: unknown) {
    return bound.aborted ? undefined : { argv, kind: 'not-started', reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Run `argv` to its end or its bound, never through a shell. At the bound the child is killed with
 * `SIGKILL`; a child a signal ended counts as having outlived its bound, as no status is left.
 *
 * @param {readonly string[]} argv - The command and its arguments.
 * @param {RunOptions} options - Where it runs, its bound and what it reads.
 * @returns {Promise<Outcome>} How it ended.
 */
async function run(argv: readonly string[], options: RunOptions): Promise<Outcome> {
  const [command, ...args] = argv;
  if (command === undefined) {
    return { argv, kind: 'not-started', reason: 'empty argv' };
  }
  const bound = AbortSignal.timeout(options.timeoutMs);
  const child = spawn(command, args, { cwd: options.cwd, env: options.env, killSignal: 'SIGKILL', signal: bound });
  const piped = feed(child.stdin, options.input);
  const closing: Promise<Closed> = Promise.all([once(child, 'close'), text(child.stdout), text(child.stderr)]);
  const outcome = await closeOf(argv, bound, closing);
  const finished = outcome ?? { argv, kind: 'timed-out', timeoutMs: options.timeoutMs };
  return finished.kind === 'finished' && piped.failure !== undefined ? { argv, kind: 'not-started', reason: piped.failure } : finished;
}

/**
 * Run every `argv` at once, each bounded on its own.
 *
 * @param {readonly (readonly string[])[]} argvs - The commands and their arguments.
 * @param {RunOptions} options - Where they run, each one's bound and what they read.
 * @returns {Promise<Outcome[]>} How each ended, in the order given.
 */
async function runConcurrently(argvs: readonly (readonly string[])[], options: RunOptions): Promise<Outcome[]> {
  const outcomes = await Promise.all(
    argvs.map(async (argv) => {
      const outcome = await run(argv, options);
      return outcome;
    }),
  );
  return outcomes;
}

export { environment, run, runConcurrently };
export type { Finished, Outcome };
