/**
 * `harness/scripts/dupes.ts` finds a planted clone at its floor and past it, and fails when jscpd scans less than git lists.
 *
 * Plants are written under a temporary root and scanned with the script's own flags. The token
 * counts are measured under jscpd 5.4.2; a jscpd bump re-measures them.
 */

import { mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  type Clone,
  cloneKey,
  clones,
  COMMON,
  MAX_SIZE,
  noReport,
  reportOf,
  RUNS,
  scan,
  type Runner,
} from '../lib/dupes.ts';
import { Exemptions } from '../lib/exemptions.ts';
import { fromRoot } from '../lib/paths.ts';
import { tracked } from '../lib/source-files.ts';
import { finished } from '../lib/tools.ts';

export const HARNESS_ID = 'clones';

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

function plant(files: Readonly<Record<string, string>>): { readonly root: string; readonly listed: readonly string[] } {
  const root = mkdtempSync(join(tmpdir(), 'clones-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text, 'utf8');
  }
  return { root, listed: Object.keys(files).toSorted() };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('the repository', () => {
  test('has no copied code but the clones it accepts', () => {
    const done = finished([process.execPath, fromRoot('harness/scripts/dupes.ts')], { cwd: fromRoot() });
    expect([done.status, done.stderr]).toEqual([0, '']);
  });

  test('states every flag and uses no ignore channel', () => {
    const flags = [...COMMON, ...Object.values(RUNS).flat()];
    expect(flags.filter((flag) => /^--?(ignore|config|baseline|i$|c$|p$|pattern)/.test(flag))).toEqual([]);
    expect(tracked().filter((path) => /(^|\/)\.jscpd(-baseline)?\.json$/.test(path))).toEqual([]);
  });
});

describe('the scan', () => {
  test('fails a planted clone in both runs', () => {
    const { root, listed } = plant({ 'a/one.ts': PLANT, 'b/two.ts': PLANT.replace('first', 'second') });
    expect(scan(root, ['a', 'b'], listed, NONE)).toEqual([
      'clone (exact): a/one.ts and b/two.ts',
      'clone (cross-file): a/one.ts and b/two.ts',
    ]);
  });

  test('still sees the planted clone past the floor', () => {
    const { root } = plant({ 'a/one.ts': PLANT, 'a/two.ts': PLANT });
    expect(clones('raised', reportOf(['--min-lines', '5', '--min-tokens', '70'], ['a'], root), root)).toHaveLength(1);
  });

  test('sees a small clone in two files in the cross-file run only', () => {
    const { root, listed } = plant({ 'a/one.ts': SMALL_PLANT, 'a/sub/two.ts': SMALL_PLANT, 'a/filler.ts': FILLER });
    expect(scan(root, ['a'], listed, NONE)).toEqual(['clone (cross-file): a/one.ts and a/sub/two.ts']);
  });

  test('leaves a small clone inside one file to the exact run', () => {
    const { root, listed } = plant({
      'a/one.ts': `${SMALL_PLANT}\n${SMALL_PLANT.replace('pick', 'keep')}`,
      'a/filler.ts': FILLER,
    });
    expect(scan(root, ['a'], listed, NONE)).toEqual([]);
  });

  test('passes an allowed clone and fails a stale entry', () => {
    const { root, listed } = plant({ 'a/one.ts': PLANT, 'b/two.ts': PLANT });
    const [exact] = clones('exact', reportOf(RUNS.exact, ['a', 'b'], root), root);
    expect(exact).toBeDefined();
    const both: readonly Clone[] = exact === undefined ? [] : [exact, { ...exact, run: 'cross-file' }];
    const allowed = new Exemptions(Object.fromEntries(both.map((clone) => [cloneKey(clone), 'planted'])));
    expect(scan(root, ['a', 'b'], listed, allowed)).toEqual([]);
    const stale = new Exemptions({ 'exact a/gone.ts a/one.ts 000000000000': 'planted' });
    expect(scan(root, ['a'], ['a/one.ts'], stale).at(-1)).toMatch(/^stale exemptions/);
  });

  test('fails a listed file jscpd did not scan, and lets a short one through', () => {
    const short = Array.from({ length: 20 }, (_, index) => `export const short${index} = ${index};\n`).join('');
    const { root, listed } = plant({ 'a/one.ts': FILLER, 'b/long.ts': FILLER, 'b/short.ts': short });
    expect(scan(root, ['a'], listed, NONE)).toEqual(['coverage: jscpd did not scan b/long.ts']);
  });

  test('fails a file over the size limit', () => {
    const { root, listed } = plant({ 'a/one.ts': FILLER, 'a/huge.ts': '' });
    truncateSync(join(root, 'a', 'huge.ts'), MAX_SIZE + 1);
    expect(scan(root, ['a'], listed, NONE)).toEqual([`coverage: a/huge.ts is over jscpd's size limit (${MAX_SIZE + 1} bytes)`]);
  });
});

describe('a run that gives no report', () => {
  const argv = ['jscpd'];
  test.each([
    [{ kind: 'finished', argv, status: 2, stdout: '', stderr: 'bad flag' } as const, 'exact: jscpd exited 2: bad flag'],
    [{ kind: 'timed-out', argv, timeoutMs: 300_000 } as const, 'exact: jscpd ran past 300000 ms'],
    [{ kind: 'not-started', argv, reason: 'not found' } as const, 'exact: jscpd could not start (not found): run `pnpm install`'],
    [{ kind: 'finished', argv, status: 0, stdout: '', stderr: '' } as const, 'exact: jscpd wrote no report'],
  ])('is a problem: %o', (outcome, problem) => {
    const runner: Runner = () => outcome;
    expect(scan(tmpdir(), ['a'], [], NONE, runner)[0]).toBe(problem);
  });

  test('a finished run with its report is no problem', () => {
    expect(noReport({ kind: 'finished', argv, status: 0, stdout: '', stderr: '' }, true)).toBeUndefined();
  });

  test('the report reader refuses a report of another shape', () => {
    expect(() => clones('exact', [], tmpdir())).toThrow(/is not an object/);
  });
});
