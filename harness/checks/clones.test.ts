/**
 * `harness/scripts/dupes.ts` finds a planted clone at its floor and past it, and fails when jscpd scans less than git lists.
 *
 * Plants are written under a temporary root and scanned with the script's own flags. The token
 * counts are measured under jscpd 5.4.2; a jscpd bump re-measures them.
 */

import { COMMON, MAX_SIZE, RUNS, cloneKey, clones, noReport, reportOf, scan } from '#lib/dupes.ts';
import type { Clone, Runner } from '#lib/dupes.ts';
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

describe('the repository', () => {
  test('has no copied code', () => {
    expect.hasAssertions();
    const { status, errors } = runMain();
    expect([status, errors]).toStrictEqual([EXIT_CLEAN, []]);
  });

  test('main reports a clean scan and exits 0', () => {
    expect.hasAssertions();
    const { status, errors, out } = runMain(cleanRunner);
    expect([status, errors]).toStrictEqual([EXIT_CLEAN, []]);
    expect(out).toStrictEqual([`no copied code in the ${typescriptFiles().length} held TypeScript files\n`]);
  });

  test('main reports each problem and exits 1', () => {
    expect.hasAssertions();
    const { status, errors } = runMain(failingRunner);
    expect([status, errors]).toStrictEqual([EXIT_FINDINGS, ['exact: jscpd exited 2: planted\n', 'cross-file: jscpd exited 2: planted\n']]);
  });

  test('states every flag and uses no ignore channel', () => {
    expect.hasAssertions();
    const flags = [...COMMON, ...Object.values(RUNS).flat()];
    expect(flags.filter((flag) => FLAGS_OUTSIDE_THE_SCRIPT.test(flag))).toStrictEqual([]);
    expect(tracked().filter((path) => BASELINE_FILES.test(path))).toStrictEqual([]);
  });
});

describe('the scan of a clone', () => {
  afterEach(async () => {
    await removePlants();
  });

  test('fails a planted clone in both runs', async () => {
    expect.hasAssertions();
    const { root, listed } = await plant({ 'a/one.ts': PLANT, 'b/two.ts': PLANT.replace('first', 'second') });
    expect(scan(root, ['a', 'b'], listed, NONE)).toStrictEqual(['clone (exact): a/one.ts and b/two.ts', 'clone (cross-file): a/one.ts and b/two.ts']);
  });

  test('still sees the planted clone past the floor', async () => {
    expect.hasAssertions();
    const { root } = await plant({ 'a/one.ts': PLANT, 'a/two.ts': PLANT });
    expect(clones('raised', reportOf(['--min-lines', '5', '--min-tokens', '70'], ['a'], root), root)).toHaveLength(ONE_CLONE);
  });

  test('sees a small clone in two files in the cross-file run only', async () => {
    expect.hasAssertions();
    const { root, listed } = await plant({ 'a/filler.ts': FILLER, 'a/one.ts': SMALL_PLANT, 'a/sub/two.ts': SMALL_PLANT });
    expect(scan(root, ['a'], listed, NONE)).toStrictEqual(['clone (cross-file): a/one.ts and a/sub/two.ts']);
  });

  test('leaves a small clone inside one file to the exact run', async () => {
    expect.hasAssertions();
    const { root, listed } = await plant({ 'a/filler.ts': FILLER, 'a/one.ts': `${SMALL_PLANT}\n${SMALL_PLANT.replace('pick', 'keep')}` });
    expect(scan(root, ['a'], listed, NONE)).toStrictEqual([]);
  });

  test('passes an allowed clone and fails a stale entry', async () => {
    expect.hasAssertions();
    const { root, listed } = await plant({ 'a/one.ts': PLANT, 'b/two.ts': PLANT });
    const [exact] = clones('exact', reportOf(RUNS.exact, ['a', 'b'], root), root);
    expect(exact).toBeDefined();
    const allowed = new Exemptions(Object.fromEntries(bothRuns(exact).map((clone) => [cloneKey(clone), 'planted'])));
    expect(scan(root, ['a', 'b'], listed, allowed)).toStrictEqual([]);
    const stale = new Exemptions({ 'exact a/gone.ts a/one.ts 000000000000': 'planted' });
    expect(lastOf(scan(root, ['a'], ['a/one.ts'], stale))).toMatch(/^StaleExemptionError: stale exemptions/u);
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
    expect(scan(root, ['a'], listed, NONE)).toStrictEqual(['coverage: jscpd did not scan b/long.ts']);
  });

  test('fails a file over the size limit', async () => {
    expect.hasAssertions();
    const { root, listed } = await plant({ 'a/huge.ts': '', 'a/one.ts': FILLER });
    await growTo(root, 'a/huge.ts', MAX_SIZE + OVER_LIMIT);
    expect(scan(root, ['a'], listed, NONE)).toStrictEqual([`coverage: a/huge.ts is over jscpd's size limit (${MAX_SIZE + OVER_LIMIT} bytes)`]);
  });
});

describe('a run that gives no report', () => {
  const argv = ['jscpd'];

  test.each([
    [{ argv, kind: 'finished', status: EXIT_BROKEN, stderr: 'bad flag', stdout: '' } as const, 'exact: jscpd exited 2: bad flag'],
    [{ argv, kind: 'timed-out', timeoutMs: 300_000 } as const, 'exact: jscpd ran past 300000 ms'],
    [{ argv, kind: 'not-started', reason: 'not found' } as const, 'exact: jscpd could not start (not found): run `pnpm install`'],
    [{ argv, kind: 'finished', status: EXIT_CLEAN, stderr: '', stdout: '' } as const, 'exact: jscpd wrote no report'],
  ])('is a problem: %o', (outcome: Outcome, problem) => {
    expect.hasAssertions();
    const runner: Runner = () => outcome;
    const [first] = scan(tmpdir(), ['a'], [], NONE, runner);
    expect(first).toBe(problem);
  });

  test('a finished run with its report is no problem', () => {
    expect.hasAssertions();
    expect(noReport({ argv, kind: 'finished', status: EXIT_CLEAN, stderr: '', stdout: '' }, true)).toBeUndefined();
  });

  test('the report reader refuses a report of another shape', () => {
    expect.hasAssertions();
    expect(() => clones('exact', [], tmpdir())).toThrow(/is not an object/u);
    expect(() => clones('exact', { duplicates: 1 }, tmpdir())).toThrow(/where the duplicates list belongs/u);
  });
});

export { HARNESS_ID };
