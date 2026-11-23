/**
 * `harness/scripts/dupes.ts` finds a planted clone at its floor and past it, and fails when jscpd scans less than git lists.
 *
 * Plants are written under a temporary root and scanned with the script's own flags. The token
 * counts are measured under jscpd 5.4.2; a jscpd bump re-measures them.
 */

import { COMMON, MAX_SIZE, RUNS, cloneKey, clones, noReport, reportOf, scan } from '#lib/dupes.ts';
import type { Clone, Reported, Run, Runner } from '#lib/dupes.ts';
import { EXIT_BROKEN, EXIT_CLEAN, EXIT_FINDINGS } from './exit-status.ts';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanRunner, failingRunner, growTo, plant, removePlants, runMain } from './clones.plants.ts';
import { Exemptions } from '#lib/exemptions.ts';
import type { Outcome } from '#lib/process.ts';
import { tmpdir } from 'node:os';
import { tracked } from '#lib/source-files.ts';
import { typescriptFiles } from '#lib/scope.ts';

const HARNESS_ID = 'clones';

// Eight lines, 84 tokens under jscpd 5.4.2: over the exact run's floor of 50 by 34.
const PLANT = `export function first(rows: readonly { country: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.country.trim().toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
`;
// Seven lines, 45 tokens: under the exact run's floor of 50 by 5, over the cross-file run's 30 by 15.
const SMALL_PLANT = `export function pick(rows: string[]): string[] {
  const kept = [...rows];
  kept.sort();
  kept.reverse();
  kept.pop();
  return kept;
}
`;
/** The lines of the filler, and the step between its values: enough to clear every floor and match nothing. */
const FILLER_LINES = 21;
const FILLER_STEP = 7;
/** The lines of a file too short for jscpd to report. */
const SHORT_LINES = 20;
// A file over every floor and like no other, so the exact run analyses something (`--fail-on-empty`).
const FILLER = Array.from({ length: FILLER_LINES }, (_value, index) => `export const value${index} = ${index * FILLER_STEP};\n`).join('');
const NONE = new Exemptions({});
/** The planted clone, seen once past the raised floor. */
const ONE_CLONE = 1;
/** How far the huge plant is over jscpd's size limit. */
const OVER_LIMIT = 1;
const FLAGS_OUTSIDE_THE_SCRIPT = /^--?(?:ignore|config|baseline|i$|c$|p$|pattern)/u;
const BASELINE_FILES = /(?:^|\/)\.jscpd(?:-baseline)?\.json$/u;

/**
 * A clone's entry in both runs.
 *
 * @param {Clone | undefined} clone - A clone of the exact run.
 * @returns {readonly Clone[]} The clone in the exact and the cross-file run.
 */
function bothRuns(clone: Clone | undefined): readonly Clone[] {
  return clone === undefined ? [] : [clone, { ...clone, run: 'cross-file' }];
}

/**
 * The last problem of a scan.
 *
 * @param {readonly string[]} problems - A scan's problems.
 * @returns {string | undefined} The last one.
 */
function lastOf(problems: readonly string[]): string | undefined {
  const [last] = problems.toReversed();
  return last;
}

/**
 * The clones of a run that gave its report; a run that gave none fails the test with its reason.
 *
 * @param {Reported} reported - What the run gave.
 * @param {Run} name - The run's name.
 * @param {string} root - The root.
 * @returns {readonly Clone[]} The clones, same-file pairs kept.
 */
function reportedClones(reported: Reported, name: Run, root: string): readonly Clone[] {
  if (reported.kind === 'none') {
    throw new Error(`the run gave no report: ${reported.reason}`);
  }
  return clones({ name, sameFile: true }, reported.report, root);
}

describe('the repository', () => {
  test('has no copied code', async () => {
    expect.hasAssertions();
    const { status, errors } = await runMain();
    expect([status, errors]).toStrictEqual([EXIT_CLEAN, []]);
  });

  test('main reports a clean scan and exits 0', async () => {
    expect.hasAssertions();
    const { status, errors, out } = await runMain(cleanRunner);
    expect([status, errors]).toStrictEqual([EXIT_CLEAN, []]);
    const files = await typescriptFiles();
    expect(out).toStrictEqual([`no copied code in the ${files.length} held TypeScript files\n`]);
  });

  test('main reports each problem and exits 1', async () => {
    expect.hasAssertions();
    const { status, errors } = await runMain(failingRunner);
    expect([status, errors]).toStrictEqual([EXIT_FINDINGS, ['cross-file: jscpd exited 2: planted\n', 'exact: jscpd exited 2: planted\n']]);
  });

  test('states every flag and uses no ignore channel', async () => {
    expect.hasAssertions();
    const flags = [...COMMON, ...RUNS.words.flatMap((name) => RUNS.of(name).flags)];
    expect(flags.filter((flag) => FLAGS_OUTSIDE_THE_SCRIPT.test(flag))).toStrictEqual([]);
    const listed = await tracked();
    expect(listed.filter((path) => BASELINE_FILES.test(path))).toStrictEqual([]);
  });
});

describe('the scan of a clone', () => {
  afterEach(async () => {
    await removePlants();
  });

  test('fails a planted clone in both runs', async () => {
    expect.hasAssertions();
    const { root, listed } = await plant({ 'a/one.ts': PLANT, 'b/two.ts': PLANT.replace('first', 'second') });
    await expect(scan({ listed, root, roots: ['a', 'b'] }, NONE)).resolves.toStrictEqual([
      'clone (cross-file): a/one.ts and b/two.ts',
      'clone (exact): a/one.ts and b/two.ts',
    ]);
  });

  test('still sees the planted clone past the floor', async () => {
    expect.hasAssertions();
    const { root } = await plant({ 'a/one.ts': PLANT, 'a/two.ts': PLANT });
    const raised = await reportOf(['--min-lines', '5', '--min-tokens', '70'], { root, roots: ['a'] });
    expect(reportedClones(raised, 'exact', root)).toHaveLength(ONE_CLONE);
  });

  test('sees a small clone in two files in the cross-file run only', async () => {
    expect.hasAssertions();
    const { root, listed } = await plant({ 'a/filler.ts': FILLER, 'a/one.ts': SMALL_PLANT, 'a/sub/two.ts': SMALL_PLANT });
    await expect(scan({ listed, root, roots: ['a'] }, NONE)).resolves.toStrictEqual(['clone (cross-file): a/one.ts and a/sub/two.ts']);
  });

  test('leaves a small clone inside one file to the exact run', async () => {
    expect.hasAssertions();
    const { root, listed } = await plant({ 'a/filler.ts': FILLER, 'a/one.ts': `${SMALL_PLANT}\n${SMALL_PLANT.replace('pick', 'keep')}` });
    await expect(scan({ listed, root, roots: ['a'] }, NONE)).resolves.toStrictEqual([]);
  });

  test('passes an allowed clone and fails a stale entry', async () => {
    expect.hasAssertions();
    const { root, listed } = await plant({ 'a/one.ts': PLANT, 'b/two.ts': PLANT });
    const reported = await reportOf(RUNS.of('exact').flags, { root, roots: ['a', 'b'] });
    const [exact] = reportedClones(reported, 'exact', root);
    expect(exact).toBeDefined();
    const allowed = new Exemptions(Object.fromEntries(bothRuns(exact).map((clone) => [cloneKey(clone), 'planted'])));
    await expect(scan({ listed, root, roots: ['a', 'b'] }, allowed)).resolves.toStrictEqual([]);
    const stale = new Exemptions({ 'exact a/gone.ts a/one.ts 000000000000': 'planted' });
    const staleProblems = await scan({ listed: ['a/one.ts'], root, roots: ['a'] }, stale);
    expect(lastOf(staleProblems)).toMatch(/^StaleExemptionError: stale exemptions/u);
  });
});

describe('the scan of what jscpd reads', () => {
  afterEach(async () => {
    await removePlants();
  });

  test('fails a listed file jscpd did not scan, and lets a short one through', async () => {
    expect.hasAssertions();
    const short = Array.from({ length: SHORT_LINES }, (_value, index) => `export const short${index} = ${index};\n`).join('');
    const { root, listed } = await plant({ 'a/one.ts': FILLER, 'b/long.ts': FILLER, 'b/short.ts': short });
    await expect(scan({ listed, root, roots: ['a'] }, NONE)).resolves.toStrictEqual(['coverage: jscpd did not scan b/long.ts']);
  });

  test('fails a file over the size limit', async () => {
    expect.hasAssertions();
    const { root, listed } = await plant({ 'a/huge.ts': '', 'a/one.ts': FILLER });
    await growTo(root, 'a/huge.ts', MAX_SIZE + OVER_LIMIT);
    await expect(scan({ listed, root, roots: ['a'] }, NONE)).resolves.toStrictEqual([
      `coverage: a/huge.ts is over jscpd's size limit (${MAX_SIZE + OVER_LIMIT} bytes)`,
    ]);
  });
});

describe('a run that gives no report', () => {
  const argv = ['jscpd'];

  test.each([
    [{ argv, kind: 'finished', status: EXIT_BROKEN, stderr: 'bad flag', stdout: '' } as const, 'jscpd exited 2: bad flag'],
    [{ argv, kind: 'timed-out', timeoutMs: 300_000 } as const, 'jscpd ran past 300000 ms'],
    [{ argv, kind: 'not-started', reason: 'not found' } as const, 'jscpd could not start (not found): run `pnpm install`'],
    [{ argv, kind: 'finished', status: EXIT_CLEAN, stderr: '', stdout: '' } as const, 'jscpd wrote no report'],
  ])('is a problem of each run: %o', async (outcome: Outcome, problem) => {
    expect.hasAssertions();
    const runner: Runner = async () => {
      const ran = await Promise.resolve(outcome);
      return ran;
    };
    await expect(scan({ listed: [], root: tmpdir(), roots: ['a'] }, NONE, runner)).resolves.toStrictEqual(
      RUNS.words.map((name) => `${name}: ${problem}`),
    );
  });

  test('a finished run with its report is no problem', () => {
    expect.hasAssertions();
    expect(noReport({ argv, kind: 'finished', status: EXIT_CLEAN, stderr: '', stdout: '' }, true)).toBeUndefined();
  });

  test('the report reader refuses a report of another shape', () => {
    expect.hasAssertions();
    expect(() => clones({ name: 'exact', sameFile: true }, [], tmpdir())).toThrow(/is not an object/u);
    expect(() => clones({ name: 'exact', sameFile: true }, { duplicates: 1 }, tmpdir())).toThrow(
      "jscpd's report's duplicates is not a list: 1",
    );
  });
});

export { HARNESS_ID };
