/** Runs jscpd once, with every flag stated here, and reads its JSON report. */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { Outcome } from './process.ts';
import { fromRoot } from './paths.ts';
import { json } from './config.ts';
import { noReport } from './dupes-report.ts';
import path from 'node:path';
import { run } from './process.ts';
import { tmpdir } from 'node:os';

/** What a scan covers: the checkout it runs in, the roots jscpd reads, and the files it must have scanned. */
interface Target {
  readonly root: string;
  readonly roots: readonly string[];
  readonly listed: readonly string[];
}

/** The runner jscpd is started through; the scan takes it so a check can plant an outcome. */
type Runner = (argv: readonly string[], cwd: string) => Outcome;

const MAX_SIZE_MB = 100;
const TIMEOUT_MS = 300_000;

/** The bytes in jscpd's megabyte, a mebibyte. */
const BYTES_PER_MB = 1_048_576;

/** Jscpd's `--max-size` in bytes. */
const MAX_SIZE: number = MAX_SIZE_MB * BYTES_PER_MB;

const COMMON: readonly string[] = [
  '--format',
  'typescript,tsx',
  '--max-size',
  `${MAX_SIZE_MB}mb`,
  '--absolute',
  '--fail-on-empty',
  '--reporters',
  'json',
  '--summary',
  '--summary-top',
  '1000000',
  '--no-colors',
];

const RUNS: Readonly<Record<'exact' | 'cross-file', readonly string[]>> = {
  'cross-file': ['--min-lines', '5', '--min-tokens', '30'],
  exact: ['--min-lines', '5', '--min-tokens', '50'],
};

/**
 * The jscpd command line of one run: the run's flags, the common flags, the report folder, the roots.
 *
 * @param {readonly string[]} flags - The run's flags.
 * @param {readonly string[]} roots - The roots jscpd reads.
 * @param {string} output - The report folder.
 * @returns {readonly string[]} The command and its arguments.
 */
function command(flags: readonly string[], roots: readonly string[], output: string): readonly string[] {
  return [fromRoot('node_modules', '.bin', 'jscpd'), ...flags, ...COMMON, '--output', output, ...roots];
}

/**
 * Start jscpd through the repository's process owner.
 *
 * @param {readonly string[]} argv - The command and its arguments.
 * @param {string} cwd - Where it runs.
 * @returns {Outcome} How it ended.
 */
function defaultRunner(argv: readonly string[], cwd: string): Outcome {
  return run(argv, { cwd, timeoutMs: TIMEOUT_MS });
}

/**
 * Run jscpd once.
 *
 * @param {readonly string[]} flags - The run's flags.
 * @param {Readonly<Pick<Target, 'root' | 'roots'>>} target - The checkout and the roots jscpd reads.
 * @param {Runner} runner - How jscpd is started.
 * @returns {unknown} The parsed report, or the reason it gave none.
 */
function reportOf(flags: readonly string[], target: Readonly<Pick<Target, 'root' | 'roots'>>, runner: Runner = defaultRunner): unknown {
  const folder = mkdtempSync(path.join(tmpdir(), 'jscpd-'));
  try {
    const outcome = runner(command(flags, target.roots, folder), target.root);
    const report = path.join(folder, 'jscpd-report.json');
    const problem = noReport(outcome, existsSync(report));
    return problem ?? json(readFileSync(report, 'utf8'));
  } finally {
    rmSync(folder, { force: true, recursive: true });
  }
}

export { COMMON, MAX_SIZE, reportOf, RUNS };
export type { Runner, Target };
