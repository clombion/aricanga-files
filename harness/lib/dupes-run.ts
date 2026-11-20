/** Runs jscpd once, with every flag stated here, and reads its JSON report. */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { Outcome } from './process.ts';
import { fromRoot } from './paths.ts';
import { isFile } from './source-files.ts';
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
type Runner = (argv: readonly string[], cwd: string) => Promise<Outcome>;

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

/** The report jscpd writes into its output folder. */
const REPORT = 'jscpd-report.json';

/**
 * Start jscpd through the repository's process owner.
 *
 * @param {readonly string[]} argv - The command and its arguments.
 * @param {string} cwd - Where it runs.
 * @returns {Promise<Outcome>} How it ended.
 */
async function defaultRunner(argv: readonly string[], cwd: string): Promise<Outcome> {
  const outcome = await run(argv, { cwd, timeoutMs: TIMEOUT_MS });
  return outcome;
}

/**
 * Run jscpd once.
 *
 * @param {readonly string[]} flags - The run's flags.
 * @param {Readonly<Pick<Target, 'root' | 'roots'>>} target - The checkout and the roots jscpd reads.
 * @param {Runner} runner - How jscpd is started.
 * @returns {Promise<unknown>} The parsed report, or the reason it gave none.
 */
async function reportOf(
  flags: readonly string[],
  target: Readonly<Pick<Target, 'root' | 'roots'>>,
  runner: Runner = defaultRunner,
): Promise<unknown> {
  const folder = await mkdtemp(path.join(tmpdir(), 'jscpd-'));
  try {
    const outcome = await runner(command(flags, target.roots, folder), target.root);
    const report = path.join(folder, REPORT);
    const written = await isFile(folder, REPORT);
    const problem = noReport(outcome, written);
    return problem ?? json(await readFile(report, 'utf8'));
  } finally {
    await rm(folder, { force: true, recursive: true });
  }
}

export { COMMON, MAX_SIZE, reportOf, RUNS };
export type { Runner, Target };
