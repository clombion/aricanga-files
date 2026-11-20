/** What the `clones` check plants: temporary roots of files, and runners standing in for jscpd. */

import { EXIT_BROKEN, EXIT_CLEAN } from './exit-status.ts';
import { dirname, join } from 'node:path/posix';
import { mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import type { Outcome } from '#lib/process.ts';
import { REPO_ROOT } from '#lib/paths.ts';
import type { Runner } from '#lib/dupes.ts';
import { main } from '#lib/dupes.ts';
import { tmpdir } from 'node:os';
import { typescriptFiles } from '#lib/scope.ts';
import { writeFileSync } from 'node:fs';

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
 * The `Runner` a stand-in implements is synchronous, as the script's real runner is, so the report
 * is on disk when it returns: the write cannot be asynchronous without changing that contract.
 *
 * @param {string} output - The report's folder.
 * @param {readonly string[]} files - The absolute paths the report lists as scanned.
 */
function writeReport(output: string, files: readonly string[]): void {
  writeFileSync(join(output, 'jscpd-report.json'), JSON.stringify({ duplicates: [], summary: { files: files.map((path) => ({ path })) } }));
}

/**
 * A runner standing in for a clean jscpd: its report lists every held file and no clone.
 *
 * @param {readonly string[]} argv - The run's arguments, naming the report's folder after `--output`.
 * @returns {Outcome} A clean finished run.
 */
function cleanRunner(argv: readonly string[]): Outcome {
  const [, output = ''] = argv.slice(argv.indexOf('--output'));
  writeReport(output, typescriptFiles().map((path) => join(REPO_ROOT, path)));
  return { argv, kind: 'finished', status: EXIT_CLEAN, stderr: '', stdout: '' };
}

/**
 * A runner whose jscpd exits 2.
 *
 * @param {readonly string[]} argv - The run's arguments.
 * @returns {Outcome} A broken finished run.
 */
function failingRunner(argv: readonly string[]): Outcome {
  return { argv, kind: 'finished', status: EXIT_BROKEN, stderr: 'planted', stdout: '' };
}

/**
 * Run the script's `main` and collect what it writes.
 *
 * @param {Runner} [runner] - The runner standing in for jscpd, or the real one.
 * @returns {{ readonly status: number; readonly out: readonly string[]; readonly errors: readonly string[] }} Its exit status and output.
 */
function runMain(runner?: Runner): { readonly status: number; readonly out: readonly string[]; readonly errors: readonly string[] } {
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
  const status = runner === undefined ? main(streams) : main(streams, runner);
  return { errors, out, status };
}

export { cleanRunner, failingRunner, growTo, plant, removePlants, runMain };
