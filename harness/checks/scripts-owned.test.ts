/**
 * The entry scripts whose logic lives in its owner module (the coverage floor, jscpd, the performance
 * baseline) hand it the real streams, paths and tools, and end with the exit code it returns.
 */

import { COVERAGE_DIR, DEBT, main as floorMain } from '#lib/coverage.ts';
import { REPO_ROOT, fromRoot } from '#lib/paths.ts';
import { RUNS, recordBaseline } from '#lib/performance-baseline.ts';
import { STOOD_IN, exitOf } from './scripts.run.ts';
import { describe, expect, test, vi } from 'vitest';
import { err, out } from '#lib/output.ts';
import { main as dupesMain } from '#lib/dupes.ts';
import { finished } from '#lib/tools.ts';
import { writeText } from '#lib/source-files.ts';

vi.mock(import('#lib/coverage.ts'), async (original) => {
  const module = await original();
  const stand = await import('./scripts.run.ts');
  return { ...module, main: vi.fn<typeof module.main>(stand.stoodIn) };
});

vi.mock(import('#lib/dupes.ts'), async (original) => {
  const module = await original();
  const stand = await import('./scripts.run.ts');
  return { ...module, main: vi.fn<typeof module.main>(stand.stoodIn) };
});

vi.mock(import('#lib/performance-baseline.ts'), async (original) => {
  const module = await original();
  const stand = await import('./scripts.run.ts');
  return { ...module, recordBaseline: vi.fn<typeof module.recordBaseline>(stand.settles) };
});

describe('the owned entry scripts', () => {
  test('coverage-floor holds the debt against the gate run', async () => {
    expect.hasAssertions();
    await expect(exitOf('coverage-floor.ts')).resolves.toBe(STOOD_IN);
    expect(floorMain).toHaveBeenCalledWith(err, DEBT, COVERAGE_DIR);
  });

  test('dupes reports on both streams', async () => {
    expect.hasAssertions();
    await expect(exitOf('dupes.ts')).resolves.toBe(STOOD_IN);
    expect(dupesMain).toHaveBeenCalledWith({ err, out });
  });

  test('performance-baseline runs the spec with the locked runner and writes through the one writer', async () => {
    expect.hasAssertions();
    await expect(exitOf('performance-baseline.ts')).resolves.toBeUndefined();
    expect(recordBaseline).toHaveBeenCalledWith({
      out,
      results: fromRoot('packages/characterisation/.output/results'),
      root: REPO_ROOT,
      run: finished,
      runs: RUNS,
      write: writeText,
    });
  });
});
