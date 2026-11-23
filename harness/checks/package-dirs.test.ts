/** A package's spelling: one directory, its manifest and importer derived from it, and the nearest root of a path. */

import { describe, expect, test } from 'vitest';
import { dirOfImporter, importerOf, manifestOf, nearest } from '#lib/package-dirs.ts';
import type { Dir } from '#lib/package-dirs.ts';
import { QUOTED_KEYS } from './scope.plants.ts';
import { lockOf } from '#lib/pins.ts';

/**
 * A root's path, for `nearest`.
 *
 * @param {Readonly<{ root: string }>} item - An item with a root.
 * @returns {string} Its root.
 */
function rootOf(item: Readonly<{ root: string }>): string {
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
    expect(keys.map((importer) => importerOf(dirOfImporter(importer)))).toStrictEqual(keys);
  });

  test('is held by the nearest root whatever order the roots come in', () => {
    expect.hasAssertions();
    const outer = { root: 'packages/a/' };
    const inner = { root: 'packages/a/b/' };
    expect([
      nearest([outer, inner], rootOf, 'packages/a/b/x.ts'),
      nearest([inner, outer], rootOf, 'packages/a/b/x.ts'),
      nearest([inner, outer], rootOf, 'packages/a/x.ts'),
      nearest([inner, outer], rootOf, 'harness/x.ts'),
    ]).toStrictEqual([inner, inner, outer, undefined]);
  });
});
