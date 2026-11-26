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

import type { Clone, Run } from './dupes-report.ts';
import { EXIT_FAILURE, EXIT_SUCCESS } from './output.ts';
import { MAX_SIZE, RUNS, onReported, reportOf } from './dupes-run.ts';
import type { RunFacts, Runner, Target } from './dupes-run.ts';
import { cloneKey, clones, scanned } from './dupes-report.ts';
import { population, typescriptOf } from './scope.ts';
import { readFile, stat } from 'node:fs/promises';
import { Exemptions } from './exemptions.ts';
import type { Population } from './scope.ts';
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

/** A run's problems and its clones. */
type RunResult = readonly [readonly string[], readonly Clone[]];

/** The clones the project accepts, each with its reason. */
const ALLOWED: Exemptions = Exemptions.grouped({});

/**
 * Why jscpd should have scanned a listed file and did not, or cannot scan it.
 *
 * @param {string} listed - The file, relative to the root.
 * @param {Readonly<ReadonlySet<string>>} seen - The files jscpd scanned.
 * @param {string} root - The root.
 * @returns {Promise<string | undefined>} The problem, or undefined.
 */
async function coverageProblem(listed: string, seen: Readonly<ReadonlySet<string>>, root: string): Promise<string | undefined> {
  const full = path.join(root, listed);
  const { size } = await stat(full);
  if (size > MAX_SIZE) {
    return `coverage: ${listed} is over jscpd's size limit (${size} bytes)`;
  }
  const text = await readFile(full, 'utf8');
  const lines = text.split('\n').length - TRAILING_LINE;
  return !seen.has(listed) && lines > SMALL_FILE_LINES ? `coverage: jscpd did not scan ${listed}` : undefined;
}

/**
 * The problems and clones of a run that gave its report: each listed file jscpd did not scan, where
 * the run checks it, and the clones.
 *
 * @param {readonly [Run, RunFacts]} named - The run's name and facts.
 * @param {unknown} report - Its parsed report.
 * @param {Target} target - What the scan covers.
 * @returns {Promise<RunResult>} The run's problems and its clones.
 */
async function fromReport(named: readonly [Run, RunFacts], report: unknown, target: Target): Promise<RunResult> {
  const [name, facts] = named;
  const seen = scanned(report, target.root);
  const coverage = facts.coverage
    ? await Promise.all(
        target.listed.map(async (listed) => {
          const problem = await coverageProblem(listed, seen, target.root);
          return problem;
        }),
      )
    : [];
  return [coverage.filter((problem) => problem !== undefined), clones({ name, sameFile: facts.sameFile }, report, target.root)];
}
/**
 * The problems and clones of one run.
 *
 * @param {readonly [Run, RunFacts]} named - The run's name and facts.
 * @param {Target} target - What the scan covers.
 * @param {Runner | undefined} runner - How jscpd is started; the repository's process owner when undefined.
 * @returns {Promise<RunResult>} The run's problems and its clones.
 */
async function runOnce(named: readonly [Run, RunFacts], target: Target, runner: Runner | undefined): Promise<RunResult> {
  const [name, facts] = named;
  const reported = await reportOf(facts.flags, target, runner);
  const ran = await onReported<Promise<RunResult> | RunResult>(
    reported,
    async (report) => {
      const found = await fromReport(named, report, target);
      return found;
    },
    (reason) => [[`${name}: ${reason}`], []],
  );
  return ran;
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
 * @returns {Promise<readonly string[]>} The problems.
 */
async function scan(target: Target, allowed: Readonly<Exemptions>, runner?: Runner): Promise<readonly string[]> {
  const runs = await Promise.all(
    RUNS.words.map(async (name) => {
      const result = await runOnce([name, RUNS.of(name)], target, runner);
      return result;
    }),
  );
  const problems = runs.flatMap(([runProblems]: RunResult) => runProblems);
  return [
    ...problems,
    ...cloneProblems(
      runs.flatMap(([, found]: RunResult) => found),
      allowed,
    ),
  ];
}

/**
 * What jscpd scans of a population: each of its roots, as a directory, and each TypeScript file it
 * holds outside them, so the roots and the files come from one population.
 *
 * @param {Population} held - The population.
 * @returns {readonly string[]} The roots and the files, as jscpd's arguments.
 */
function scanRoots(held: Population): readonly string[] {
  const directories = held.roots.map((root) => root.replace(TRAILING_SLASH, ''));
  const rootFiles = typescriptOf(held).filter((file) => !held.roots.some((root) => file.startsWith(root)));
  return [...directories, ...rootFiles];
}

/**
 * Scan the held TypeScript (the roots, and held files outside them).
 *
 * @param {Streams} streams - Where the result and the problems are written.
 * @param {Runner | undefined} runner - How jscpd is started; the repository's process owner when undefined.
 * @returns {Promise<number>} The exit status.
 */
async function main(streams: Streams, runner?: Runner): Promise<number> {
  const held = await population();
  const listed = typescriptOf(held);
  const problems = await scan({ listed, root: REPO_ROOT, roots: scanRoots(held) }, ALLOWED, runner);
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
export type { Clone, Run } from './dupes-report.ts';
export { COMMON, MAX_SIZE, onReported, reportOf, RUNS } from './dupes-run.ts';
export type { Reported, Runner } from './dupes-run.ts';
export { main, scan, scanRoots };
