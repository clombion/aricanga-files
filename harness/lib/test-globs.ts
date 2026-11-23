/**
 * The gate's Vitest globs over the members: which tests the `rebuild` project collects and which
 * sources coverage reads. A member contributes a glob only where the listing gives it a file to
 * match, so no glob of a member is dead.
 */

import type { Member, Population } from './scope.ts';
import { matches } from './globs.ts';

/**
 * A member's glob, kept when a listed file matches it.
 *
 * @param {Population} population - The population.
 * @param {readonly Member[]} members - The members.
 * @param {string} tail - The glob under each member's directory.
 * @returns {string[]} Each member's live glob.
 */
function liveGlobs(population: Population, members: readonly Member[], tail: string): string[] {
  return members.map((member) => `${member.dir}${tail}`).filter((glob) => population.listing.some((file) => matches(glob, file)));
}

/**
 * The tests of the `rebuild` project: each shipping member's `*.test.ts` and `*.test.tsx`. A test
 * infrastructure package's tests are not Vitest's: `test:browser` lists the Playwright configs.
 *
 * @param {Population} population - The population.
 * @returns {string[]} The include globs.
 */
function testIncludes(population: Population): string[] {
  return liveGlobs(population, population.shipping, '**/*.test.{ts,tsx}');
}

/**
 * The member sources coverage reads: each shipping member's `src/`.
 *
 * @param {Population} population - The population.
 * @returns {string[]} The coverage include globs of the members.
 */
function coverageIncludes(population: Population): string[] {
  return liveGlobs(population, population.shipping, 'src/**');
}

export { coverageIncludes, testIncludes };
