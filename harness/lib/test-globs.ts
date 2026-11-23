/**
 * The gate's test globs: which modules a test runner runs (`isRunnerTest`, from `VITEST_TESTS` and
 * `PLAYWRIGHT_SPECS`), the harness's own test project (`HARNESS_CHECKS`), which tests the `rebuild`
 * project collects and which sources coverage reads. A member contributes a glob only where the
 * listing gives it a file to match, so no glob of a member is dead.
 */

import type { Member, Population } from './scope.ts';
import { matches } from './globs.ts';

/** The harness's own test project: its checks and their support, which coverage does not read. */
const HARNESS_CHECKS = 'harness/checks/';

/** The modules Vitest runs: the gate's test include and its coverage exclude. */
const VITEST_TESTS = '**/*.test.{ts,tsx}';

/** The modules Playwright runs, as `packages/characterisation/browsers.ts` matches them under each config's `testDir`. */
const PLAYWRIGHT_SPECS = '**/*.spec.ts';

/**
 * Whether a module is run by a test runner: a Vitest test or a Playwright spec.
 *
 * @param {string} path - A repository-relative path.
 * @returns {boolean} Whether a runner runs it.
 */
function isRunnerTest(path: string): boolean {
  return matches(VITEST_TESTS, path) || matches(PLAYWRIGHT_SPECS, path);
}

/**
 * A member's glob, kept when one of the member's own listed files matches it: a file of a member
 * nested in it is the nested member's (`memberOf`), not this one's.
 *
 * @param {Population} population - The population.
 * @param {readonly Member[]} members - The members.
 * @param {string} tail - The glob under each member's directory.
 * @returns {string[]} Each member's live glob.
 */
function liveGlobs(population: Population, members: readonly Member[], tail: string): string[] {
  return members.flatMap((member) => {
    const glob = `${member.dir}${tail}`;
    return population.listing.some((file) => file.startsWith(member.dir) && population.memberOf(file) === member && matches(glob, file))
      ? [glob]
      : [];
  });
}

/**
 * The tests of the `rebuild` project: each shipping member's `*.test.ts` and `*.test.tsx`. A test
 * infrastructure package's tests are not Vitest's: `test:browser` lists the Playwright configs.
 *
 * @param {Population} population - The population.
 * @returns {string[]} The include globs.
 */
function testIncludes(population: Population): string[] {
  return liveGlobs(population, population.shipping, VITEST_TESTS);
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

export { coverageIncludes, HARNESS_CHECKS, isRunnerTest, testIncludes, VITEST_TESTS };
