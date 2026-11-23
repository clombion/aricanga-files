/** The gate's Vitest globs: a shipping member's tests are collected and its sources covered. */

import { coverageIncludes, testIncludes } from '#lib/test-globs.ts';
import { describe, expect, test } from 'vitest';
import { manifest, reader } from './scope.plants.ts';
import type { Population } from '#lib/scope.ts';
import { populationOf } from '#lib/scope.ts';

/**
 * A population of four members: a foundation with tests, a view whose tests are TSX, a
 * test-infrastructure member with a listed `*.test.ts`, and an experience with neither tests nor sources.
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
      'packages/probe/package.json': manifest('test-infrastructure'),
      'packages/view/package.json': manifest('view'),
    }),
    workspace: ['', 'packages/bare/', 'packages/core/', 'packages/probe/', 'packages/view/'],
  });
  return held;
}

describe('the gate globs', () => {
  test("collect each shipping member's listed tests, a .test.tsx included, and no test-infrastructure member's", async () => {
    expect.hasAssertions();
    expect(testIncludes(await planted())).toStrictEqual(['packages/core/**/*.test.{ts,tsx}', 'packages/view/**/*.test.{ts,tsx}']);
  });

  test("cover each shipping member's listed sources, and no test-infrastructure member's", async () => {
    expect.hasAssertions();
    expect(coverageIncludes(await planted())).toStrictEqual(['packages/core/src/**', 'packages/view/src/**']);
  });
});
