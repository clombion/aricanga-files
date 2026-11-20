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

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { json, object } from './config.ts';
import { Exemptions, StaleExemptionError } from './exemptions.ts';
import { fromRoot } from './paths.ts';
import { type Outcome, run } from './process.ts';
import { relativeTo as posixRelative } from './relative.ts';

export const MAX_SIZE_MB = 100;
/** jscpd's `--max-size` in bytes (its megabytes are MiB). */
export const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024;
export const SMALL_FILE_LINES = 20;
export const TIMEOUT_MS = 300_000;

export const COMMON: readonly string[] = [
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

export const RUNS: Readonly<Record<'exact' | 'cross-file', readonly string[]>> = {
  exact: ['--min-lines', '5', '--min-tokens', '50'],
  'cross-file': ['--min-lines', '5', '--min-tokens', '30'],
};

/** A clone jscpd found: the run, the two files (relative to the root, sorted) and the fragment's hash. */
export interface Clone {
  readonly run: string;
  readonly first: string;
  readonly second: string;
  readonly fragment: string;
}

export function cloneKey(clone: Clone): string {
  return `${clone.run} ${clone.first} ${clone.second} ${clone.fragment}`;
}

/** The clones the project accepts, each with its reason. */
export const ALLOWED = Exemptions.grouped({
  'adopting: move the story/open/run input builders the chat tests copy into @narratives/system-chat/testing': [
    'exact packages/systems/chat/test/defer.test.ts packages/systems/chat/test/read-state.test.ts 5b1d76746369',
    'exact packages/systems/chat/test/defer.test.ts packages/systems/chat/test/routing.test.ts d48e2a34f956',
    'exact packages/systems/chat/test/defer.test.ts packages/systems/chat/test/regression-ledger.ts f5afdc07d1fb',
    'cross-file packages/systems/chat/test/defer.test.ts packages/systems/chat/test/read-state.test.ts 5b1d76746369',
    'cross-file packages/systems/chat/test/defer.test.ts packages/systems/chat/test/routing.test.ts d48e2a34f956',
    'cross-file packages/systems/chat/test/defer.test.ts packages/systems/chat/test/regression-ledger.ts f5afdc07d1fb',
    'cross-file packages/systems/chat/test/defer.test.ts packages/systems/chat/test/read-state.test.ts 38fbaadcf97a',
    'cross-file packages/systems/chat/test/defer.test.ts packages/systems/chat/test/routing.test.ts b237992c1737',
    'cross-file packages/systems/chat/test/routing.test.ts packages/systems/chat/test/time.test.ts 194c764d2f9b',
  ],
  'adopting: build the system of the host runtime test from fixtureSystem instead of restating its reducer': [
    'exact packages/foundation/src/host/runtime.test.ts packages/foundation/src/testing/fixture-system.ts 4d262ff87ebe',
    'cross-file packages/foundation/src/host/runtime.test.ts packages/foundation/src/testing/fixture-system.ts 4d262ff87ebe',
    'cross-file packages/foundation/src/host/runtime.test.ts packages/foundation/src/testing/fixture-system.ts fc95b8f8a982',
  ],
});

/** The jscpd command line of one run: the run's flags, the common flags, the report folder, the roots. */
export function command(binary: string, flags: readonly string[], roots: readonly string[], output: string): readonly string[] {
  return [binary, ...flags, ...COMMON, '--output', output, ...roots];
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function relativeTo(name: unknown, root: string): string {
  return posixRelative(root, String(name));
}

/** The clones of a parsed jscpd JSON report; the cross-file run keeps the pairs in two files. */
export function clones(runName: string, report: unknown, root: string): readonly Clone[] {
  const found: Clone[] = [];
  for (const entry of list(object(report, "jscpd's report").duplicates)) {
    const fields = object(entry, 'a duplicate');
    const first = relativeTo(object(fields.firstFile, 'firstFile').name, root);
    const second = relativeTo(object(fields.secondFile, 'secondFile').name, root);
    if (runName === 'cross-file' && first === second) {
      continue;
    }
    const fragment = createHash('sha256').update(String(fields.fragment)).digest('hex').slice(0, 12);
    const [low = first, high = second] = [first, second].toSorted();
    found.push({ run: runName, first: low, second: high, fragment });
  }
  return found;
}

/** The files a parsed jscpd JSON report's summary lists, relative to the root. */
export function scanned(report: unknown, root: string): ReadonlySet<string> {
  const summary = object(object(report, "jscpd's report").summary ?? {}, 'summary');
  return new Set(list(summary.files).map((entry) => relativeTo(object(entry, 'a summary file').path, root)));
}

/** The listed files jscpd should have scanned and did not, or cannot scan. */
export function coverageProblems(listed: readonly string[], seen: ReadonlySet<string>, root: string): readonly string[] {
  const problems: string[] = [];
  for (const path of listed) {
    const size = statSync(join(root, path)).size;
    if (size > MAX_SIZE) {
      problems.push(`coverage: ${path} is over jscpd's size limit (${size} bytes)`);
    } else if (!seen.has(path) && readFileSync(join(root, path), 'utf8').split('\n').length - 1 > SMALL_FILE_LINES) {
      problems.push(`coverage: jscpd did not scan ${path}`);
    }
  }
  return problems;
}

/** What a run that gave no report says. */
export function noReport(outcome: Outcome, reported: boolean): string | undefined {
  if (outcome.kind === 'timed-out') {
    return `jscpd ran past ${outcome.timeoutMs} ms`;
  }
  if (outcome.kind === 'not-started') {
    return `jscpd could not start (${outcome.reason}): run \`pnpm install\``;
  }
  if (outcome.status !== 0) {
    return `jscpd exited ${outcome.status}: ${outcome.stdout}${outcome.stderr}`;
  }
  return reported ? undefined : 'jscpd wrote no report';
}

/** The runner jscpd is started through; the scan takes it so a check can plant an outcome. */
export type Runner = (argv: readonly string[], cwd: string) => Outcome;

export const defaultRunner: Runner = (argv, cwd) => run(argv, { timeoutMs: TIMEOUT_MS, cwd });

/** Run jscpd once and return its parsed report, or the reason it gave none. */
export function reportOf(flags: readonly string[], roots: readonly string[], root: string, runner: Runner = defaultRunner): unknown {
  const folder = mkdtempSync(join(tmpdir(), 'jscpd-'));
  try {
    const outcome = runner(command(fromRoot('node_modules', '.bin', 'jscpd'), flags, roots, folder), root);
    const report = join(folder, 'jscpd-report.json');
    const problem = noReport(outcome, existsSync(report));
    return problem ?? json(readFileSync(report, 'utf8'));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** Every problem of the runs: clones not allowed, stale entries, a coverage gap, a run with no report. */
export function scan(
  root: string,
  roots: readonly string[],
  listed: readonly string[],
  allowed: Exemptions,
  runner: Runner = defaultRunner,
): readonly string[] {
  const problems: string[] = [];
  const found: Clone[] = [];
  for (const [runName, flags] of Object.entries(RUNS)) {
    const report = reportOf(flags, roots, root, runner);
    if (typeof report === 'string') {
      problems.push(`${runName}: ${report}`);
      continue;
    }
    found.push(...clones(runName, report, root));
    if (runName === 'exact') {
      problems.push(...coverageProblems(listed, scanned(report, root), root));
    }
  }
  try {
    problems.push(
      ...allowed.unexemptedBy(found, cloneKey).map((clone) => `clone (${clone.run}): ${clone.first} and ${clone.second}`),
    );
  } catch (error) {
    if (!(error instanceof StaleExemptionError)) {
      throw error;
    }
    problems.push(error.message);
  }
  return problems;
}
