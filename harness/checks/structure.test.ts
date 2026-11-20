/**
 * No module is both `.ts` and `.tsx`, and no build output is committed under the held roots.
 *
 * Over the listing's held files: a module stem with both a `.ts` and a `.tsx` file makes an import
 * resolve by accident of extension order; and a file under a folder named `dist`, `coverage`,
 * `.output` or `node_modules`, or a `*.tsbuildinfo`, is what a build makes, which the gate rebuilds
 * and git must not hold.
 */

import { describe, expect, test } from 'vitest';
import { Prefixes } from '#lib/exemptions.ts';
import { heldFiles } from '#lib/scope.ts';

const HARNESS_ID = 'structure';

const BUILD_DIRECTORIES = /(?:^|\/)(?:dist|coverage|\.output|node_modules)\//u;
/** A stem held as more than one kind of module. */
const ONE_KIND = 1;
const BUILD_FILES = new Prefixes(['.tsbuildinfo']);
const MODULE = /\.tsx?$/u;

/**
 * The module stems that exist as both `.ts` and `.tsx`.
 *
 * @param {readonly string[]} paths - The paths.
 * @returns {string[]} The module stems that exist as both `.ts` and `.tsx`.
 */
function doubleModules(paths: readonly string[]): string[] {
  const stems = new Map<string, Set<string>>();
  for (const path of paths.filter((candidate) => MODULE.test(candidate))) {
    const stem = path.replace(MODULE, '');
    stems.set(stem, (stems.get(stem) ?? new Set()).add(path.endsWith('.tsx') ? '.tsx' : '.ts'));
  }
  return [...stems]
    .filter(([, kinds]: readonly [string, ReadonlySet<string>]) => kinds.size > ONE_KIND)
    .map(([stem]: readonly [string, ReadonlySet<string>]) => stem)
    .toSorted();
}

/**
 * The listed files that are build output.
 *
 * @param {readonly string[]} paths - The paths.
 * @returns {string[]} The listed files that are build output.
 */
function buildOutput(paths: readonly string[]): string[] {
  return paths.filter((path) => BUILD_DIRECTORIES.test(path) || BUILD_FILES.ends(path));
}

describe('the repository', () => {
  test('no module is both .ts and .tsx', async () => {
    expect.hasAssertions();
    expect(doubleModules(await heldFiles())).toStrictEqual([]);
  });

  test('no build output is listed', async () => {
    expect.hasAssertions();
    expect(buildOutput(await heldFiles())).toStrictEqual([]);
  });
});

describe('the structure checks', () => {
  test('see a module written both ways, and let a test beside its module through', () => {
    expect.hasAssertions();
    expect(
      doubleModules([
        'packages/plant/src/view.ts',
        'packages/plant/src/view.tsx',
        'packages/plant/src/part.tsx',
        'packages/plant/src/part.test.tsx',
        'harness/lib/a.ts',
      ]),
    ).toStrictEqual(['packages/plant/src/view']);
  });

  test.each([
    'packages/plant/dist/index.js',
    'experiences/plant/dist/assets/a.js',
    'packages/plant/coverage/index.html',
    'packages/characterisation/.output/report/index.html',
    'packages/plant/node_modules/x/index.js',
    'packages/plant/tsconfig.tsbuildinfo',
  ])('sees the planted build output %s', (path) => {
    expect.hasAssertions();
    expect(buildOutput([path, 'packages/plant/src/index.ts'])).toStrictEqual([path]);
  });

  test.each(['packages/plant/src/distance.ts', 'packages/plant/src/coverage-floor.ts', 'docs/output.md'])(
    'lets a near miss through: %s',
    (path) => {
      expect.hasAssertions();
      expect(buildOutput([path])).toStrictEqual([]);
    },
  );
});

export { HARNESS_ID, buildOutput, doubleModules };
