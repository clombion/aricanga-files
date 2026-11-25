/** The gate's Vitest globs: a shipping member's tests are collected and its sources covered. */

import { HARNESS_CHECKS, VITEST_TESTS, coverageIncludes, isRunnerTest, testIncludes } from '#lib/test-globs.ts';
import { coverageOf, gateTest, globsOf, projectsOf } from './gate-config.ts';
import { describe, expect, test } from 'vitest';
import type { Population } from '#lib/scope.ts';
import { matches } from '#lib/globs.ts';
import { plantedPopulation } from '#lib/scan-hooks.ts';
import { typescriptFiles } from '#lib/scope.ts';

const HARNESS_ID = 'test-globs';

/**
 * A population of six members: a foundation with tests, a view whose tests are TSX, a
 * test-infrastructure member with a listed `*.test.ts`, an experience with neither tests nor sources,
 * a view with sources and no test, and a view with a test and no source.
 *
 * @returns {Promise<Population>} The population.
 */
async function planted(): Promise<Population> {
  const held = await plantedPopulation(
    [
      'packages/lib/src/l.ts',
      'packages/spec/test/s.test.ts',
      'packages/core/src/a.ts',
      'packages/core/test/a.test.ts',
      'packages/probe/src/b.ts',
      'packages/probe/test/c.test.ts',
      'packages/view/src/v.tsx',
      'packages/view/test/v.test.tsx',
    ],
    [
      ['packages/bare/', 'experience'],
      ['packages/core/', 'foundation'],
      ['packages/lib/', 'view'],
      ['packages/probe/', 'test-infrastructure'],
      ['packages/spec/', 'view'],
      ['packages/view/', 'view'],
    ],
  );
  return held;
}

describe('the gate globs', () => {
  test("collect each shipping member's listed tests, a .test.tsx included, and no test-infrastructure member's", async () => {
    expect.hasAssertions();
    expect(testIncludes(await planted())).toStrictEqual([
      'packages/core/**/*.test.{ts,tsx}',
      'packages/spec/**/*.test.{ts,tsx}',
      'packages/view/**/*.test.{ts,tsx}',
    ]);
  });

  test("keep no glob of a member whose only matching files are a nested member's", async () => {
    expect.hasAssertions();
    const nested = await plantedPopulation(
      ['packages/a/b/test/t.test.ts'],
      [
        ['packages/a/', 'foundation'],
        ['packages/a/b/', 'test-infrastructure'],
      ],
    );
    expect(testIncludes(nested)).toStrictEqual([]);
  });

  test("cover each shipping member's listed sources, and no test-infrastructure member's", async () => {
    expect.hasAssertions();
    expect(coverageIncludes(await planted())).toStrictEqual(['packages/core/src/**', 'packages/lib/src/**', 'packages/view/src/**']);
  });
});

/**
 * The Vitest tests among some files that no include collects.
 *
 * @param {readonly string[]} files - The files.
 * @param {readonly string[]} includes - Every project's include globs.
 * @returns {readonly string[]} The tests no project collects.
 */
function uncollected(files: readonly string[], includes: readonly string[]): readonly string[] {
  return files.filter((path) => matches(VITEST_TESTS, path) && !includes.some((glob) => matches(glob, path)));
}

/**
 * The paths no glob matches.
 *
 * @param {readonly string[]} paths - The paths.
 * @param {readonly string[]} globs - The globs.
 * @returns {readonly string[]} The paths outside every glob.
 */
function unmatched(paths: readonly string[], globs: readonly string[]): readonly string[] {
  return paths.filter((path) => !globs.some((glob) => matches(glob, path)));
}

/** Runner tests no listed file holds today: a Playwright spec under a member's `src/`, a harness check in TSX. */
const PLANTED_TESTS: readonly string[] = ['packages/foundation/src/a.spec.ts', 'harness/checks/a.test.tsx'];

describe('the repository', () => {
  test('excludes from coverage every module a runner runs, and collects every harness check, planted forms included', async () => {
    expect.hasAssertions();
    const [files, settings] = await Promise.all([typescriptFiles(), gateTest()]);
    const excluded = globsOf(coverageOf(settings), 'exclude');
    const includes = projectsOf(settings).flatMap((project) => globsOf(project, 'include'));
    const tests = [...files, ...PLANTED_TESTS].filter((path) => isRunnerTest(path));
    const checks = tests.filter((path) => path.startsWith(HARNESS_CHECKS));
    expect([unmatched(tests, excluded), unmatched(checks, includes)]).toStrictEqual([[], []]);
  });

  test('collects every held Vitest test in a project of the gate config', async () => {
    expect.hasAssertions();
    const [files, settings] = await Promise.all([typescriptFiles(), gateTest()]);
    const includes = projectsOf(settings).flatMap((project) => globsOf(project, 'include'));
    expect(uncollected(files, includes)).toStrictEqual([]);
  });
});

export { HARNESS_ID };
