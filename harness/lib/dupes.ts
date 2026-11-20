/**
 * Finds copied code with the pinned jscpd, over the harness's roots, with every flag stated here.
 *
 * Two runs, each from the repository root with no config file, over TypeScript only and reading
 * only the JSON report:
 *
 * - `exact`: clones of at least 5 lines and 50 tokens, jscpd's default floor, anywhere in the roots;
 * - `cross-file`: clones of at least 30 tokens whose two copies are in different files (a six-line
 *   copy is 30 tokens or more), where a copy is most often a rule restated, such as a test
 *   rebuilding production's logic. Copies inside one file at this floor are left to the exact run.
 *
 * The exact run's summary lists the files jscpd scanned. Every held `.ts`/`.tsx` file must be in it,
 * except one of `SMALL_FILE_LINES` lines or fewer, which falls under the clone floor; a file over
 * `MAX_SIZE` fails, since jscpd skips it silently, and so does a run with no report. It runs inside
 * the git checkout: jscpd reads `.gitignore` only there.
 *
 * A clone the project accepts goes in `ALLOWED`, keyed by `cloneKey`: the run, both paths and the
 * fragment's hash, with its reason; an entry that matches no clone fails the run.
 */

import { EXIT_FAILURE, EXIT_SUCCESS } from './output.ts';
import { MAX_SIZE, RUNS, reportOf } from './dupes-run.ts';
import { ROOTS, typescriptFiles } from './scope.ts';
import type { Runner, Target } from './dupes-run.ts';
import { cloneKey, clones, scanned } from './dupes-report.ts';
import { readFileSync, statSync } from 'node:fs';
import type { Clone } from './dupes-report.ts';
import { Exemptions } from './exemptions.ts';
import { REPO_ROOT } from './paths.ts';
import { isEmpty } from './lists.ts';
import path from 'node:path';

/** The output streams `main` writes to; a check passes its own. */
interface Streams {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}


const SMALL_FILE_LINES = 20;

/** The line count of a text past the empty string after its last newline. */
const TRAILING_LINE = 1;

const TRAILING_SLASH = /\/$/u;


/** The clones the project accepts, each with its reason. */
const ALLOWED: Exemptions = Exemptions.grouped({});

/**
 * Why jscpd should have scanned a listed file and did not, or cannot scan it.
 *
 * @param {string} listed - The file, relative to the root.
 * @param {Readonly<ReadonlySet<string>>} seen - The files jscpd scanned.
 * @param {string} root - The root.
 * @returns {string | undefined} The problem, or undefined.
 */
function coverageProblem(listed: string, seen: Readonly<ReadonlySet<string>>, root: string): string | undefined {
  const full = path.join(root, listed);
  const { size } = statSync(full);
  if (size > MAX_SIZE) {
    return `coverage: ${listed} is over jscpd's size limit (${size} bytes)`;
  }
  const lines = readFileSync(full, 'utf8').split('\n').length - TRAILING_LINE;
  return !seen.has(listed) && lines > SMALL_FILE_LINES ? `coverage: jscpd did not scan ${listed}` : undefined;
}

/**
 * The problems and clones of one run.
 *
 * @param {readonly [string, readonly string[]]} named - The run's name and flags.
 * @param {Target} target - What the scan covers.
 * @param {Runner | undefined} runner - How jscpd is started; the repository's process owner when undefined.
 * @returns {readonly [readonly string[], readonly Clone[]]} The run's problems and its clones.
 */
function runOnce(named: readonly [string, readonly string[]], target: Target, runner: Runner | undefined): readonly [readonly string[], readonly Clone[]] {
  const [runName, flags] = named;
  const report = reportOf(flags, target, runner);
  if (typeof report === 'string') {
    return [[`${runName}: ${report}`], []];
  }
  const coverage =
    runName === 'exact'
      ? target.listed.flatMap((listed) => coverageProblem(listed, scanned(report, target.root), target.root) ?? [])
      : [];
  return [coverage, clones(runName, report, target.root)];
}

/**
 * The clones no entry allows, as problems; a stale entry is a problem too.
 *
 * @param {readonly Clone[]} found - The clones found.
 * @param {Readonly<Exemptions>} allowed - The clones the project accepts.
 * @returns {readonly string[]} The problems.
 */
function cloneProblems(found: readonly Clone[], allowed: Readonly<Exemptions>): readonly string[] {
  try {
    return allowed.unexemptedBy(found, cloneKey).map((clone) => `clone (${clone.run}): ${clone.first} and ${clone.second}`);
  } catch (error: unknown) {
    return [String(error)];
  }
}

/**
 * Every problem of the runs: clones not allowed, stale entries, a coverage gap, a run with no report.
 *
 * @param {Target} target - What the scan covers.
 * @param {Readonly<Exemptions>} allowed - The clones the project accepts.
 * @param {Runner | undefined} runner - How jscpd is started; the repository's process owner when undefined.
 * @returns {readonly string[]} The problems.
 */
function scan(target: Target, allowed: Readonly<Exemptions>, runner?: Runner): readonly string[] {
  const runs = Object.entries(RUNS).map((named: readonly [string, readonly string[]]) => runOnce(named, target, runner));
  const problems = runs.flatMap(([runProblems]: readonly [readonly string[], readonly Clone[]]) => runProblems);
  return [...problems, ...cloneProblems(runs.flatMap(([, found]: readonly [readonly string[], readonly Clone[]]) => found), allowed)];
}

/**
 * Scan the held TypeScript (the roots, and held files outside them).
 *
 * @param {Streams} streams - Where the result and the problems are written.
 * @param {Runner | undefined} runner - How jscpd is started; the repository's process owner when undefined.
 * @returns {number} The exit status.
 */
function main(streams: Streams, runner?: Runner): number {
  const listed = typescriptFiles();
  const directories = ROOTS.map((root) => root.replace(TRAILING_SLASH, ''));
  const rootFiles = listed.filter((file) => !ROOTS.some((root) => file.startsWith(root)));
  const problems = scan({ listed, root: REPO_ROOT, roots: [...directories, ...rootFiles] }, ALLOWED, runner);
  for (const problem of problems) {
    streams.err(`${problem}\n`);
  }
  if (isEmpty(problems)) {
    streams.out(`no copied code in the ${listed.length} held TypeScript files\n`);
    return EXIT_SUCCESS;
  }
  return EXIT_FAILURE;
}

export { cloneKey, clones, noReport } from './dupes-report.ts';
export type { Clone } from './dupes-report.ts';
export { COMMON, MAX_SIZE, reportOf, RUNS } from './dupes-run.ts';
export type { Runner, Target } from './dupes-run.ts';
export { main, scan };
export type { Streams };
