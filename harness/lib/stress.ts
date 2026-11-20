/**
 * The flake hunter: the gate's Vitest run, several copies at once, each shuffling files and tests by
 * its own seed, running each file's tests concurrently and repeating every test. A test that passes
 * only in its usual order, or only when nothing else runs beside it, fails here. The base seed is
 * printed so a failing hunt replays exactly.
 */

import { bin, isolatedEnv } from './tools.ts';
import { Accepted } from './exemptions.ts';
import { REPO_ROOT } from './paths.ts';
import { randomInt } from 'node:crypto';
import { runConcurrently } from './process.ts';

/** One hunt: where it runs, the base seed, how many copies run at once and how often each test repeats. */
interface Hunt {
  readonly root: string;
  readonly config: string;
  readonly seed: number;
  readonly copies: number;
  readonly repeats: number;
  /** Vitest file filters; empty runs every test of the config. */
  readonly filters: readonly string[];
}

/** One copy's result: its seed, its exit status (`NOT_FINISHED` if it did not finish) and its output. */
interface CopyResult {
  readonly seed: number;
  readonly status: number;
  readonly output: string;
}

/** The bound on one copy of a hunt. */
const COPY_TIMEOUT_MS = 900_000;

/** How many tests of a file a copy runs at once. */
const MAX_CONCURRENCY = 32;

/** The status of a copy that did not finish. */
const NOT_FINISHED = -1;

/** The fewest copies, repeats or seed a hunt accepts. */
const LEAST = 1;

/** The defaults of a hunt's counts. */
const DEFAULT_COPIES = 4;
const DEFAULT_REPEATS = 2;

/** The largest base seed a hunt draws, exclusive. */
const SEED_BOUND = 1_000_000;

/** The flags a hunt reads; every other argument is a file filter. */
const FLAGS = new Accepted(['--seed', '--copies', '--repeats']);

/**
 * The Vitest invocation of one copy of a hunt.
 *
 * @param {Hunt} options - The hunt.
 * @param {number} index - The copy's index.
 * @returns {readonly string[]} The copy's command and arguments.
 */
function copyArgv(options: Hunt, index: number): readonly string[] {
  return [
    bin('vitest'),
    'run',
    '--root',
    options.root,
    '--config',
    options.config,
    '--sequence.shuffle',
    '--sequence.seed',
    String(options.seed + index),
    '--sequence.concurrent',
    '--maxConcurrency',
    String(MAX_CONCURRENCY),
    '--repeats',
    String(options.repeats),
    ...options.filters,
  ];
}

/**
 * Run every copy of a hunt at once.
 *
 * @param {Hunt} options - The hunt.
 * @returns {Promise<readonly CopyResult[]>} Each copy's result, in copy order.
 */
async function hunt(options: Hunt): Promise<readonly CopyResult[]> {
  const argvs = Array.from({ length: options.copies }, (_unused, index) => copyArgv(options, index));
  const outcomes = await runConcurrently(argvs, { cwd: options.root, env: isolatedEnv(), timeoutMs: COPY_TIMEOUT_MS });
  return outcomes.map((outcome, index) => ({
    output: outcome.kind === 'finished' ? outcome.stdout + outcome.stderr : JSON.stringify(outcome),
    seed: options.seed + index,
    status: outcome.kind === 'finished' ? outcome.status : NOT_FINISHED,
  }));
}

/**
 * The value given after a flag.
 *
 * @param {readonly string[]} args - The command-line arguments.
 * @param {string} name - The flag.
 * @returns {string | undefined} Its value, or undefined when it is absent.
 */
function flag(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at === NOT_FINISHED ? undefined : args.at(at + LEAST);
}

/**
 * A flag's value as a positive integer.
 *
 * @param {readonly string[]} args - The command-line arguments.
 * @param {string} name - The flag.
 * @param {number} fallback - The value when the flag is absent.
 * @returns {number} The value.
 */
function count(args: readonly string[], name: string, fallback: number): number {
  const value = Number(flag(args, name) ?? fallback);
  if (!Number.isSafeInteger(value) || value < LEAST) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

/**
 * A hunt from command-line arguments: `--seed`, `--copies`, `--repeats`; the rest are file filters.
 *
 * @param {readonly string[]} args - The command-line arguments.
 * @returns {Hunt} The hunt.
 */
function huntOf(args: readonly string[]): Hunt {
  const flagValues = new Set(args.flatMap((arg, index) => (FLAGS.has(arg) ? [index + LEAST] : [])));
  const filters = args.filter((arg, index) => !FLAGS.has(arg) && !flagValues.has(index));
  return {
    config: 'vitest.gate.config.ts',
    copies: count(args, '--copies', DEFAULT_COPIES),
    filters,
    repeats: count(args, '--repeats', DEFAULT_REPEATS),
    root: REPO_ROOT,
    seed: count(args, '--seed', randomInt(LEAST, SEED_BOUND)),
  };
}

export { hunt, huntOf };
export type { CopyResult, Hunt };
