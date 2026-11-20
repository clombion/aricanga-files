/**
 * The flake hunter: the gate's Vitest run, several copies at once, each shuffling files and tests by
 * its own seed, running each file's tests concurrently and repeating every test. A test that passes
 * only in its usual order, or only when nothing else runs beside it, fails here. The base seed is
 * printed so a failing hunt replays exactly.
 */

import { randomInt } from 'node:crypto';

import { REPO_ROOT } from './paths.ts';
import { runConcurrently } from './process.ts';
import { bin, isolatedEnv } from './tools.ts';

/** One hunt: where it runs, the base seed, how many copies run at once and how often each test repeats. */
export interface Hunt {
  readonly root: string;
  readonly config: string;
  readonly seed: number;
  readonly copies: number;
  readonly repeats: number;
  /** Vitest file filters; empty runs every test of the config. */
  readonly filters: readonly string[];
}

/** One copy's result: its seed, its exit status (-1 if it did not finish) and its output. */
export interface CopyResult {
  readonly seed: number;
  readonly status: number;
  readonly output: string;
}

/** The bound on one copy of a hunt. */
const COPY_TIMEOUT_MS = 900_000;

/** The Vitest invocation of copy `index` of a hunt. */
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
    '32',
    '--repeats',
    String(options.repeats),
    ...options.filters,
  ];
}

/** Run every copy of a hunt at once. */
export async function hunt(options: Hunt): Promise<readonly CopyResult[]> {
  const argvs = Array.from({ length: options.copies }, (_, index) => copyArgv(options, index));
  const outcomes = await runConcurrently(argvs, { timeoutMs: COPY_TIMEOUT_MS, cwd: options.root, env: isolatedEnv() });
  return outcomes.map((outcome, index) => ({
    seed: options.seed + index,
    status: outcome.kind === 'finished' ? outcome.status : -1,
    output: outcome.kind === 'finished' ? outcome.stdout + outcome.stderr : JSON.stringify(outcome),
  }));
}

function flag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

/** A hunt from command-line arguments: `--seed`, `--copies`, `--repeats`; the rest are file filters. */
export function huntOf(args: readonly string[]): Hunt {
  const named = new Set(['--seed', '--copies', '--repeats']);
  const filters = args.filter((arg, index) => !named.has(arg) && !named.has(args[index - 1] ?? ''));
  const number = (name: string, fallback: number): number => {
    const value = Number(flag(args, name) ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive integer`);
    }
    return value;
  };
  return {
    root: REPO_ROOT,
    config: 'vitest.gate.config.ts',
    seed: number('--seed', randomInt(1, 1_000_000)),
    copies: number('--copies', 4),
    repeats: number('--repeats', 2),
    filters,
  };
}
