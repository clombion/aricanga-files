/**
 * `harness/scripts/dupes.ts` finds a planted clone at its floor and past it, and fails when jscpd scans less than git lists.
 *
 * Plants are written under a temporary root and scanned with the script's own flags. The token
 * counts are measured under jscpd 5.4.2; a jscpd bump re-measures them.
 */

import { COMMON, MAX_SIZE, RUNS, cloneKey, clones, main, noReport, reportOf, scan } from '#lib/dupes.ts';
import type { Clone, Runner } from '#lib/dupes.ts';
import { afterEach, describe, expect, test } from 'vitest';
import { dirname, join } from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { Exemptions } from '#lib/exemptions.ts';
import { REPO_ROOT } from '#lib/paths.ts';
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
// A file over every floor and like no other, so the exact run analyses something (`--fail-on-empty`).
const FILLER = Array.from({ length: 21 }, (_, index) => `export const value${index} = ${index * 7};\n`).join('');
const NONE = new Exemptions({});

const roots: string[] = [];

/** A runner standing in for a clean jscpd: its report lists every held file and no clone. */
const cleanRunner: Runner = (argv) => {
  const output = argv[argv.indexOf('--output') + 1] ?? '';
  const files = typescriptFiles().map((path) => ({ path: join(REPO_ROOT, path) }));
  writeFileSync(join(output, 'jscpd-report.json'), JSON.stringify({ duplicates: [], summary: { files } }));
  return { argv, kind: 'finished', status: 0, stderr: '', stdout: '' };
};

/** A runner whose jscpd exits 2. */
const failingRunner: Runner = (argv) => ({ argv, kind: 'finished', status: 2, stderr: 'planted', stdout: '' });

function plant(files: Readonly<Record<string, string>>): { readonly root: string; readonly listed: readonly string[] } {
  const root = mkdtempSync(join(tmpdir(), 'clones-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text, 'utf8');
  }
  return { listed: Object.keys(files).toSorted(), root };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('the repository', () => {
  test('has no copied code', () => {
    expect.hasAssertions();
    const errors: string[] = [];
    const status = main({ err: (text) => errors.push(text), out: () => {} });
    expect([status, errors]).toStrictEqual([0, []]);
  });

  test('main reports a clean scan and exits 0', () => {
    expect.hasAssertions();
    const out: string[] = [];
    const errors: string[] = [];
    expect([main({ err: (text) => errors.push(text), out: (text) => out.push(text) }, cleanRunner), errors]).toStrictEqual([0, []]);
    expect(out).toStrictEqual([`no copied code in the ${typescriptFiles().length} held TypeScript files\n`]);
  });

  test('main reports each problem and exits 1', () => {
    expect.hasAssertions();
    const errors: string[] = [];
    expect([main({ err: (text) => errors.push(text), out: () => {} }, failingRunner), errors]).toStrictEqual([
      1,
      ['exact: jscpd exited 2: planted\n', 'cross-file: jscpd exited 2: planted\n'],
    ]);
  });

  test('states every flag and uses no ignore channel', () => {
    expect.hasAssertions();
    const flags = [...COMMON, ...Object.values(RUNS).flat()];
    expect(flags.filter((flag) => /^--?(ignore|config|baseline|i$|c$|p$|pattern)/u.test(flag))).toStrictEqual([]);
    expect(tracked().filter((path) => /(^|\/)\.jscpd(-baseline)?\.json$/u.test(path))).toStrictEqual([]);
  });
});

describe('the scan', () => {
  test('fails a planted clone in both runs', () => {
    expect.hasAssertions();
    const { root, listed } = plant({ 'a/one.ts': PLANT, 'b/two.ts': PLANT.replace('first', 'second') });
    expect(scan(root, ['a', 'b'], listed, NONE)).toStrictEqual([
      'clone (exact): a/one.ts and b/two.ts',
      'clone (cross-file): a/one.ts and b/two.ts',
    ]);
  });

  test('still sees the planted clone past the floor', () => {
    expect.hasAssertions();
    const { root } = plant({ 'a/one.ts': PLANT, 'a/two.ts': PLANT });
    expect(clones('raised', reportOf(['--min-lines', '5', '--min-tokens', '70'], ['a'], root), root)).toHaveLength(1);
  });

  test('sees a small clone in two files in the cross-file run only', () => {
    expect.hasAssertions();
    const { root, listed } = plant({ 'a/filler.ts': FILLER, 'a/one.ts': SMALL_PLANT, 'a/sub/two.ts': SMALL_PLANT });
    expect(scan(root, ['a'], listed, NONE)).toStrictEqual(['clone (cross-file): a/one.ts and a/sub/two.ts']);
  });

  test('leaves a small clone inside one file to the exact run', () => {
    expect.hasAssertions();
    const { root, listed } = plant({
      'a/filler.ts': FILLER,
      'a/one.ts': `${SMALL_PLANT}\n${SMALL_PLANT.replace('pick', 'keep')}`,
    });
    expect(scan(root, ['a'], listed, NONE)).toStrictEqual([]);
  });

  test('passes an allowed clone and fails a stale entry', () => {
    expect.hasAssertions();
    const { root, listed } = plant({ 'a/one.ts': PLANT, 'b/two.ts': PLANT });
    const [exact] = clones('exact', reportOf(RUNS.exact, ['a', 'b'], root), root);
    expect(exact).toBeDefined();
    const both: readonly Clone[] = exact === undefined ? [] : [exact, { ...exact, run: 'cross-file' }];
    const allowed = new Exemptions(Object.fromEntries(both.map((clone) => [cloneKey(clone), 'planted'])));
    expect(scan(root, ['a', 'b'], listed, allowed)).toStrictEqual([]);
    const stale = new Exemptions({ 'exact a/gone.ts a/one.ts 000000000000': 'planted' });
    expect(scan(root, ['a'], ['a/one.ts'], stale).at(-1)).toMatch(/^StaleExemptionError: stale exemptions/u);
  });

  test('fails a listed file jscpd did not scan, and lets a short one through', () => {
    expect.hasAssertions();
    const short = Array.from({ length: 20 }, (_, index) => `export const short${index} = ${index};\n`).join('');
    const { root, listed } = plant({ 'a/one.ts': FILLER, 'b/long.ts': FILLER, 'b/short.ts': short });
    expect(scan(root, ['a'], listed, NONE)).toStrictEqual(['coverage: jscpd did not scan b/long.ts']);
  });

  test('fails a file over the size limit', () => {
    expect.hasAssertions();
    const { root, listed } = plant({ 'a/huge.ts': '', 'a/one.ts': FILLER });
    truncateSync(join(root, 'a', 'huge.ts'), MAX_SIZE + 1);
    expect(scan(root, ['a'], listed, NONE)).toStrictEqual([`coverage: a/huge.ts is over jscpd's size limit (${MAX_SIZE + 1} bytes)`]);
  });
});

describe('a run that gives no report', () => {
  const argv = ['jscpd'];

  test.each([
    [{ argv, kind: 'finished', status: 2, stderr: 'bad flag', stdout: '' } as const, 'exact: jscpd exited 2: bad flag'],
    [{ argv, kind: 'timed-out', timeoutMs: 300_000 } as const, 'exact: jscpd ran past 300000 ms'],
    [{ argv, kind: 'not-started', reason: 'not found' } as const, 'exact: jscpd could not start (not found): run `pnpm install`'],
    [{ argv, kind: 'finished', status: 0, stderr: '', stdout: '' } as const, 'exact: jscpd wrote no report'],
  ])('is a problem: %o', (outcome, problem) => {
    expect.hasAssertions();
    const runner: Runner = () => outcome;
    expect(scan(tmpdir(), ['a'], [], NONE, runner)[0]).toBe(problem);
  });

  test('a finished run with its report is no problem', () => {
    expect.hasAssertions();
    expect(noReport({ argv, kind: 'finished', status: 0, stderr: '', stdout: '' }, true)).toBeUndefined();
  });

  test('the report reader refuses a report of another shape', () => {
    expect.hasAssertions();
    expect(() => clones('exact', [], tmpdir())).toThrow(/is not an object/u);
    expect(() => clones('exact', { duplicates: 1 }, tmpdir())).toThrow(/where the duplicates list belongs/u);
  });
});

export { HARNESS_ID };
