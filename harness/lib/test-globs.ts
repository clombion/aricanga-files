/**
 * The gate's test globs: which modules a test runner runs (`RUNNER_TESTS`: `VITEST_TESTS` and
 * `PLAYWRIGHT_SPECS`, read by `isRunnerTest` and the coverage exclude), the harness's own test project
 * (`HARNESS_CHECKS`), which tests the `rebuild` project collects and which sources coverage reads.
 * Every Vitest include is built from `VITEST_TESTS`. A member contributes a glob only where the listing
 * gives it a file to match, so no glob of a member is dead.
 */

import type { Member, Population } from './scope.ts';
import { Accepted } from './exemptions.ts';
import { matches } from '#lint-rules/globs.ts';

/** The harness's own test project: its checks and their support, which coverage does not read. */
const HARNESS_CHECKS = 'harness/checks/';

/** The configs a test runner loads to run a member's tests: run by the runner, shipped by no one. */
const RUNNER_CONFIGS: Accepted<string> = new Accepted<string>(['**/playwright.*.config.ts']);

/** The directories whose modules are test support, at any depth below their member's directory (read by `checker.ts`' `isProduction`). */
const TEST_DIRECTORIES: readonly string[] = ['test', 'tests', 'testing'];

/** A member's test support directory, at any depth below its directory: its tests' helpers, which run on Node. */
const TEST_SUPPORT = 'test/';

/** A test-infrastructure member's browser tests directory: its Playwright specs and their helpers, which run on Node. */
const BROWSER_TESTS = 'tests/';

/** The modules Vitest runs: the gate's test include and its coverage exclude. */
const VITEST_TESTS = '**/*.test.{ts,tsx}';

/** The modules Playwright runs, as `packages/characterisation/browsers.ts` matches them under each config's `testDir`. */
const PLAYWRIGHT_SPECS = '**/*.spec.ts';

/** The modules a test runner runs: a Vitest test or a Playwright spec. */
const RUNNER_TESTS: Accepted<string> = new Accepted<string>([VITEST_TESTS, PLAYWRIGHT_SPECS]);

/**
 * Whether a module is run by a test runner (`RUNNER_TESTS`).
 *
 * @param {string} path - A repository-relative path.
 * @returns {boolean} Whether a runner runs it.
 */
function isRunnerTest(path: string): boolean {
  return [...RUNNER_TESTS].some((glob) => matches(glob, path));
}

/**
 * Whether a module is a config a test runner loads (`RUNNER_CONFIGS`).
 *
 * @param {string} path - A repository-relative path.
 * @returns {boolean} Whether a runner loads it as its config.
 */
function isRunnerConfig(path: string): boolean {
  return [...RUNNER_CONFIGS].some((glob) => matches(glob, path));
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
    return population.listing.some(
      (file) => file.startsWith(member.dir) && population.memberOf(file)?.dir === member.dir && matches(glob, file),
    )
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

export {
  BROWSER_TESTS,
  coverageIncludes,
  HARNESS_CHECKS,
  isRunnerConfig,
  isRunnerTest,
  liveGlobs,
  RUNNER_TESTS,
  TEST_DIRECTORIES,
  TEST_SUPPORT,
  testIncludes,
  VITEST_TESTS,
};
