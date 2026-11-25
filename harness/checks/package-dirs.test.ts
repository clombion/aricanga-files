/** A package's spelling: one directory, its manifest and importer derived from it, and the nearest root of a path. */

import type { Dir, MemberDir } from '#lib/package-dirs.ts';
import { describe, expect, test } from 'vitest';
import { dirOfImporter, importerOf, manifestOf, nearestOf } from '#lib/package-dirs.ts';
import { QUOTED_KEYS } from './scope.plants.ts';
import { lockOf } from '#lib/pins.ts';

/**
 * A root's path, for `nearestOf`.
 *
 * @param {Readonly<{ root: MemberDir }>} item - An item with a root.
 * @returns {MemberDir} Its root.
 */
function rootOf(item: Readonly<{ root: MemberDir }>): MemberDir {
  return item.root;
}

describe('a package', () => {
  test('is one directory: its manifest and its importer derive from it, and an importer leads back to it', () => {
    expect.hasAssertions();
    const dirs: readonly Dir[] = ['', 'packages/a/', "a/q'uote/", 'a/x:y/', '1.0/'];
    const derived = dirs.map((dir) => {
      const importer = importerOf(dir);
      return [manifestOf(dir), importer, dirOfImporter(importer)];
    });
    expect(derived).toStrictEqual([
      ['package.json', '.', ''],
      ['packages/a/package.json', 'packages/a', 'packages/a/'],
      ["a/q'uote/package.json", "a/q'uote", "a/q'uote/"],
      ['a/x:y/package.json', 'a/x:y', 'a/x:y/'],
      ['1.0/package.json', '1.0', '1.0/'],
    ]);
    const keys = [...lockOf(QUOTED_KEYS).keys()];
    expect([keys, keys.map((importer) => importerOf(dirOfImporter(importer)))]).toStrictEqual([
      ['.', '@s/p', 'a/#hash', "a/q'uote", 'a/sp ace', 'a/x:y'],
      ['.', '@s/p', 'a/#hash', "a/q'uote", 'a/sp ace', 'a/x:y'],
    ]);
  });

  test('is held by the nearest root whatever order the roots come in', () => {
    expect.hasAssertions();
    const outer: Readonly<{ root: MemberDir }> = { root: 'packages/a/' };
    const inner: Readonly<{ root: MemberDir }> = { root: 'packages/a/b/' };
    const inOrder = nearestOf([outer, inner], rootOf);
    const reversed = nearestOf([inner, outer], rootOf);
    expect([
      inOrder('packages/a/b/x.ts'),
      reversed('packages/a/b/x.ts'),
      reversed('packages/a/x.ts'),
      reversed('harness/x.ts'),
    ]).toStrictEqual([inner, inner, outer, undefined]);
  });
});
