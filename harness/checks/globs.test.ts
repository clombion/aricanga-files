/** The harness's glob matcher, `matches`: each glob is compiled once, however often it is read. */

import { describe, test, vi } from 'vitest';
import { Minimatch } from 'minimatch';
import { matches } from '#lint-rules/globs.ts';

/** How many times each glob is compiled. */
const ONCE = 1;

/** How many times each glob is read. */
const READS = 100;

/** A glob of one directory's files in every member, read on its own. */
const MEMBER_GLOB = 'packages/*/once/**/*.ts';

/** A glob of files by suffix, read in turn with `SUBTREE_GLOB`. */
const SUFFIX_GLOB = '**/*.twice.{ts,tsx}';

/** A glob of a directory's subtree, read in turn with `SUFFIX_GLOB`. */
const SUBTREE_GLOB = 'harness/twice/**';

/**
 * How often a spy on the matcher's compile ran for each of some globs: the spy is the prototype's one,
 * shared with any test spying beside it, so each test counts its own globs only.
 *
 * @param {readonly unknown[]} compiled - The matchers the spy on `Minimatch.prototype.make` ran on.
 * @param {readonly string[]} globs - The globs.
 * @returns {readonly number[]} Each glob's compiles.
 */
function compilesOf(compiled: readonly unknown[], globs: readonly string[]): readonly number[] {
  return globs.map((glob) => compiled.filter((matcher) => matcher instanceof Minimatch && matcher.pattern === glob).length);
}

describe('the glob matcher', () => {
  test('compiles a glob once however often it reads it, and answers each read the same', ({ expect }) => {
    expect.hasAssertions();
    const compiles = vi.spyOn(Minimatch.prototype, 'make');
    const answers = Array.from({ length: READS }, (_unused, index) => [
      matches(MEMBER_GLOB, `packages/m${index}/once/x${index}.ts`),
      matches(MEMBER_GLOB, `packages/m${index}/lib/x${index}.ts`),
    ]);
    expect(answers).toStrictEqual(Array.from({ length: READS }, () => [true, false]));
    expect(compilesOf(compiles.mock.contexts, [MEMBER_GLOB])).toStrictEqual([ONCE]);
  });

  test('compiles each distinct glob once when their reads interleave', ({ expect }) => {
    expect.hasAssertions();
    const compiles = vi.spyOn(Minimatch.prototype, 'make');
    const answers = Array.from({ length: READS }, (_unused, index) => [
      matches(SUFFIX_GLOB, `packages/m${index}/x.twice.tsx`),
      matches(SUBTREE_GLOB, `harness/twice/x${index}.ts`),
    ]);
    expect(answers).toStrictEqual(Array.from({ length: READS }, () => [true, true]));
    expect(compilesOf(compiles.mock.contexts, [SUFFIX_GLOB, SUBTREE_GLOB])).toStrictEqual([ONCE, ONCE]);
  });
});
