/** What the `clones` check plants: temporary roots of files, and runners standing in for jscpd. */

import { COMMON, RUNS, main, scanRoots } from '#lib/dupes.ts';
import { EXIT_BROKEN, EXIT_CLEAN } from '#lib/exit-status.ts';
import { dirname, join } from 'node:path/posix';
import { mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { population, typescriptFiles } from '#lib/scope.ts';
import type { Outcome } from '#lib/process.ts';
import { REPO_ROOT } from '#lib/paths.ts';
import type { Runner } from '#lib/dupes.ts';
import { Scripted } from '#lib/doubles.ts';
import { tmpdir } from 'node:os';

/** The planted roots not yet removed. */
const roots = new Set<string>();

/**
 * Plant files under a fresh temporary root.
 *
 * @param {Readonly<Record<string, string>>} files - Each file's text, by path.
 * @returns {Promise<{ readonly root: string; readonly listed: readonly string[] }>} The root and the planted paths, sorted.
 */
async function plant(files: Readonly<Record<string, string>>): Promise<{ readonly root: string; readonly listed: readonly string[] }> {
  const root = await mkdtemp(join(tmpdir(), 'clones-'));
  roots.add(root);
  await Promise.all(
    Object.entries(files).map(async ([path, text]: readonly [string, string]) => {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text, 'utf8');
    }),
  );
  return { listed: Object.keys(files).toSorted(), root };
}

/**
 * Grow a planted file to `bytes` long.
 *
 * @param {string} root - The planted root.
 * @param {string} path - The file's path under the root.
 * @param {number} bytes - Its new length.
 */
async function growTo(root: string, path: string, bytes: number): Promise<void> {
  await truncate(join(root, path), bytes);
}

/** Remove every planted root. */
async function removePlants(): Promise<void> {
  const planted = [...roots];
  roots.clear();
  await Promise.all(
    planted.map(async (root) => {
      await rm(root, { force: true, recursive: true });
    }),
  );
}

/**
 * Write a report listing `files` as scanned and no clone into `output`.
 *
 * @param {string} output - The report's folder.
 * @param {readonly string[]} files - The absolute paths the report lists as scanned.
 * @returns {Promise<void>} Settles once the report is on disk.
 */
async function writeReport(output: string, files: readonly string[]): Promise<void> {
  await writeFile(
    join(output, 'jscpd-report.json'),
    JSON.stringify({ duplicates: [], summary: { files: files.map((path) => ({ path })) } }),
  );
}

/** Where a run's flags start on its command line: after the binary. */
const FLAGS_AT = 1;

/** The first common flag, which ends a run's own. */
const [COMMON_FIRST = ''] = COMMON;

/** The runs the clean runner answers: each word of `RUNS`, by its flags and the roots `main` scans. */
class CleanRuns extends Scripted<string> {}

/**
 * A runner standing in for a clean jscpd: it answers a run of `RUNS`, recognised by its flags and
 * the roots `main` scans (`scanRoots`), and trips on any other command line; its report lists every
 * held file and no clone.
 *
 * @param {readonly string[]} argv - The run's arguments, naming the report's folder after `--output`.
 * @returns {Promise<Outcome>} A clean finished run.
 */
async function cleanRunner(argv: readonly string[]): Promise<Outcome> {
  const [files, held] = await Promise.all([typescriptFiles(), population()]);
  const scans = scanRoots(files, held);
  const scripted = RUNS.words.map((name) => [JSON.stringify([RUNS.of(name).flags, scans]), name] as const);
  const runs = new CleanRuns(Object.fromEntries(scripted));
  const [, output = '', ...scanned] = argv.slice(argv.indexOf('--output'));
  const flags = argv.slice(FLAGS_AT, argv.indexOf(COMMON_FIRST));
  runs.answer(JSON.stringify([flags, scanned]));
  await writeReport(
    output,
    files.map((path) => join(REPO_ROOT, path)),
  );
  return { argv, kind: 'finished', status: EXIT_CLEAN, stderr: '', stdout: '' };
}

/**
 * A runner whose jscpd exits 2.
 *
 * @param {readonly string[]} argv - The run's arguments.
 * @returns {Promise<Outcome>} A broken finished run.
 */
async function failingRunner(argv: readonly string[]): Promise<Outcome> {
  const outcome: Outcome = await Promise.resolve({ argv, kind: 'finished', status: EXIT_BROKEN, stderr: 'planted', stdout: '' });
  return outcome;
}

/**
 * Run the script's `main` and collect what it writes.
 *
 * @param {Runner} [runner] - The runner standing in for jscpd, or the real one.
 * @returns {Promise<{ readonly status: number; readonly out: readonly string[]; readonly errors: readonly string[] }>} Its exit status and output.
 */
async function runMain(
  runner?: Runner,
): Promise<{ readonly status: number; readonly out: readonly string[]; readonly errors: readonly string[] }> {
  const out: string[] = [];
  const errors: string[] = [];
  const streams = {
    err: (text: string): void => {
      errors.push(text);
    },
    out: (text: string): void => {
      out.push(text);
    },
  };
  const status = await (runner === undefined ? main(streams) : main(streams, runner));
  return { errors, out, status };
}

export { cleanRunner, failingRunner, growTo, plant, removePlants, runMain };
