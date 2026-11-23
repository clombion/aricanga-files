/** The gate's Vitest globs: a shipping member's tests are collected and its sources covered. */

import { VITEST_TESTS, coverageIncludes, testIncludes } from '#lib/test-globs.ts';
import { describe, expect, test } from 'vitest';
import { gateTest, globsOf } from './gate-config.ts';
import { list, object } from '#lib/config.ts';
import { manifest, reader } from './scope.plants.ts';
import { populationOf, typescriptFiles } from '#lib/scope.ts';
import type { Population } from '#lib/scope.ts';
import { matches } from '#lib/globs.ts';

/**
 * A population of six members: a foundation with tests, a view whose tests are TSX, a
 * test-infrastructure member with a listed `*.test.ts`, an experience with neither tests nor sources,
 * a view with sources and no test, and a view with a test and no source.
 *
 * @returns {Promise<Population>} The population.
 */
async function planted(): Promise<Population> {
  const held = await populationOf({
    listing: [
      'packages/bare/package.json',
      'packages/core/package.json',
      'packages/probe/package.json',
      'packages/view/package.json',
      'packages/lib/package.json',
      'packages/spec/package.json',
      'packages/lib/src/l.ts',
      'packages/spec/test/s.test.ts',
      'packages/core/src/a.ts',
      'packages/core/test/a.test.ts',
      'packages/probe/src/b.ts',
      'packages/probe/test/c.test.ts',
      'packages/view/src/v.tsx',
      'packages/view/test/v.test.tsx',
    ],
    read: reader({
      'packages/bare/package.json': manifest('experience'),
      'packages/core/package.json': manifest('foundation'),
      'packages/lib/package.json': manifest('view'),
      'packages/probe/package.json': manifest('test-infrastructure'),
      'packages/spec/package.json': manifest('view'),
      'packages/view/package.json': manifest('view'),
    }),
    workspace: ['', 'packages/bare/', 'packages/core/', 'packages/lib/', 'packages/probe/', 'packages/spec/', 'packages/view/'],
  });
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
    const nested = await populationOf({
      listing: ['packages/a/package.json', 'packages/a/b/package.json', 'packages/a/b/test/t.test.ts'],
      read: reader({ 'packages/a/b/package.json': manifest('test-infrastructure'), 'packages/a/package.json': manifest('foundation') }),
      workspace: ['packages/a/', 'packages/a/b/'],
    });
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

describe('the repository', () => {
  test('collects every held Vitest test in a project of the gate config', async () => {
    expect.hasAssertions();
    const [files, settings] = await Promise.all([typescriptFiles(), gateTest()]);
    const includes = list(settings['projects'], 'projects').flatMap((project) =>
      globsOf(object(object(project, 'a project')['test'], 'a project test'), 'include'),
    );
    expect(uncollected(files, includes)).toStrictEqual([]);
  });
});
