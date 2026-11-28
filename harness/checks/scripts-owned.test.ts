/**
 * The entry scripts whose logic lives in its owner module (the coverage floor, jscpd, the performance
 * baseline) hand it the real streams, paths and tools, and end with the exit code it returns.
 */

import { COVERAGE_DIR, DEBT, main as floorMain } from '#lib/coverage.ts';
import { REPO_ROOT, fromRoot } from '#lib/paths.ts';
import { RUNS, recordBaseline } from '#lib/performance-baseline.ts';
import { STOOD_IN, exitOf, lastArgument } from './scripts.run.ts';
import { describe, test, vi } from 'vitest';
import { err, out } from '#lib/output.ts';
import { main as dupesMain } from '#lib/dupes.ts';
import { finished } from '#lib/tools.ts';
import { writeText } from '#lib/source-files.ts';

vi.mock(import('#lib/coverage.ts'), async (original) => {
  const stand = await import('./scripts.run.ts');
  return stand.withStoodIn(await original(), 'main');
});

vi.mock(import('#lib/dupes.ts'), async (original) => {
  const stand = await import('./scripts.run.ts');
  return stand.withStoodIn(await original(), 'main');
});

vi.mock(import('#lib/performance-baseline.ts'), async (original) => {
  const stand = await import('./scripts.run.ts');
  return stand.withStoodIn(await original(), 'recordBaseline');
});

// Each script sets the process's one exit code, which `exitOf` reads and clears: the tests run one at a time.
describe('the owned entry scripts', { concurrent: false }, () => {
  test('coverage-floor holds the debt against the gate run', async ({ expect }) => {
    expect.hasAssertions();
    await expect(exitOf(import('#scripts/coverage-floor.ts'))).resolves.toBe(STOOD_IN);
    expect(floorMain).toHaveBeenCalledWith(err, DEBT, COVERAGE_DIR);
  });

  test('dupes reports on both streams', async ({ expect }) => {
    expect.hasAssertions();
    await expect(exitOf(import('#scripts/dupes.ts'))).resolves.toBe(STOOD_IN);
    expect(dupesMain).toHaveBeenCalledWith({ err, out });
  });

  test('performance-baseline runs the spec with the locked runner and writes through the one writer', async ({ expect }) => {
    expect.hasAssertions();
    await expect(exitOf(import('#scripts/performance-baseline.ts'))).resolves.toBeUndefined();
    const recording = lastArgument(vi.mocked(recordBaseline).mock.calls);
    expect([recording.run, recording.write, recording.out]).toStrictEqual([finished, writeText, out]);
    expect([recording.root, recording.results, recording.runs]).toStrictEqual([
      REPO_ROOT,
      fromRoot('packages/characterisation/.output/results'),
      RUNS,
    ]);
  });
});
