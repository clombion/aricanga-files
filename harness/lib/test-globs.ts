/**
 * The gate's test and tool-config globs: which modules a test runner runs (`RUNNER_TESTS`:
 * `VITEST_TESTS` and `PLAYWRIGHT_SPECS`), which configs it loads (`RUNNER_CONFIGS`), the test
 * directories (`TEST_DIRECTORIES`), the Vite configs (`VITE_CONFIG`), the harness's own directories
 * (`HARNESS_DIRECTORIES`: its library, checks, scripts and lint rules, `HARNESS_LIB`,
 * `HARNESS_CHECKS`, `HARNESS_SCRIPTS`, `HARNESS_LINT_RULES`; every harness path in harness code is
 * composed from one of these) and tests (`HARNESS_TESTS`), which
 * tests the `rebuild` project collects and which sources coverage reads. Their readers:
 * `isProduction` (`checker.ts`), the coverage include and exclude, oxlint's Node env and
 * default-export override, knip's entries and Playwright configs, the build check and the claims'
 * probe roots. A member contributes a glob
 * only where one of its own files matches it (`Population.filesOf`), so no glob of a member is dead.
 * The member-scoped globs (`<dir>**`) assume no member is nested in another, which #58 1c refuses.
 */

import type { Member, Population } from './scope.ts';
import { NODE_SCRIPT, typescriptGlob } from './source-files.ts';
import { Accepted } from './exemptions.ts';
import { matches } from '#lint-rules/globs.ts';

/** The harness's own test project: its checks and their support, which coverage does not read. */
const HARNESS_CHECKS = 'harness/checks/';

/** The harness's library: the modules its checks, scripts and root configuration modules run. */
const HARNESS_LIB = 'harness/lib/';

/** The harness's scripts: the entry points its tasks run (each top-level module), and their helpers below. */
const HARNESS_SCRIPTS = 'harness/scripts/';

/** The harness's lint-rules package: the project's oxlint plugin, its rules and their fixtures. */
const HARNESS_LINT_RULES = 'harness/lint-rules/';

/** The harness's directories, each spelled by its one owner above: every other harness path is composed from one of them. */
const HARNESS_DIRECTORIES: Accepted<string> = new Accepted<string>([HARNESS_CHECKS, HARNESS_LIB, HARNESS_LINT_RULES, HARNESS_SCRIPTS]);

/** The modules a task runs as a script: each top-level module of the harness's scripts (a helper below one is imported, not run). */
const SCRIPT_ENTRIES: Accepted<string> = new Accepted<string>([`${HARNESS_SCRIPTS}*${NODE_SCRIPT}`]);

/** A member's Vite config, by its name: the one a Vite app is built from. */
const VITE_CONFIG = 'vite.config.ts';

/** Every Vite config, at any depth. */
const VITE_CONFIGS: Accepted<string> = new Accepted<string>([`**/${VITE_CONFIG}`]);

/** The configs a test runner loads to run a member's tests: run by the runner, shipped by no one. */
const RUNNER_CONFIGS: Accepted<string> = new Accepted<string>([typescriptGlob('**/playwright.*.config')]);

/** The directories whose modules are test support, at any depth below their member's directory (read by `checker.ts`' `isProduction`). */
const TEST_DIRECTORIES: readonly string[] = ['test', 'tests', 'testing'];

/** A member's test support directory, at any depth below its directory: its tests' helpers, which run on Node. */
const TEST_SUPPORT = 'test/';

/** A test-infrastructure member's browser tests directory: its Playwright specs and their helpers, which run on Node. */
const BROWSER_TESTS = 'tests/';

/** The modules Vitest runs: the gate's test include and its coverage exclude. */
const VITEST_TESTS: string = typescriptGlob('**/*.test');

/** The modules Playwright runs, as `packages/characterisation/browsers.ts` matches them under each config's `testDir`. */
const PLAYWRIGHT_SPECS = '**/*.spec.ts';

/** The modules a test runner runs: a Vitest test or a Playwright spec. */
const RUNNER_TESTS: Accepted<string> = new Accepted<string>([VITEST_TESTS, PLAYWRIGHT_SPECS]);

/** The harness's own tests: the Vitest tests among its checks. */
const HARNESS_TESTS: Accepted<string> = new Accepted<string>([`${HARNESS_CHECKS}${VITEST_TESTS}`]);

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
 * A member's glob, kept when one of the member's own listed files matches it (`Population.filesOf`:
 * a nested member's file is not this one's). The glob itself still matches a nested member's files;
 * #58 1c refuses a nested member.
 *
 * @param {Population} population - The population.
 * @param {readonly Member[]} members - The members.
 * @param {string} tail - The glob under each member's directory.
 * @returns {string[]} Each member's live glob.
 */
function liveGlobs(population: Population, members: readonly Member[], tail: string): string[] {
  return members.flatMap((member) => {
    const glob = `${member.dir}${tail}`;
    return population.filesOf(member).some((file) => matches(glob, file)) ? [glob] : [];
  });
}

/**
 * The Vitest tests of shipping members: each one's `*.test.ts` and `*.test.tsx`. A test
 * infrastructure package's tests are not Vitest's: `test:browser` lists the Playwright configs.
 *
 * @param {Population} population - The population.
 * @param {readonly Member[]} members - The shipping members whose tests are read (all of them by default).
 * @returns {string[]} The include globs.
 */
function testIncludes(population: Population, members: readonly Member[] = population.shipping): string[] {
  return liveGlobs(population, members, VITEST_TESTS);
}

/**
 * The Vite apps: each member whose root holds its `vite.config.ts` (`VITE_CONFIG`), the one a Vite
 * app is built from (`build.ts`' `apps`) and its tests run under (the gate's Vitest config).
 *
 * @param {Population} population - The population.
 * @returns {readonly Member[]} The apps, in the population's order.
 */
function viteApps(population: Population): readonly Member[] {
  return population.members.filter((member) => population.filesOf(member).includes(`${member.dir}${VITE_CONFIG}`));
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
  HARNESS_DIRECTORIES,
  HARNESS_LIB,
  HARNESS_LINT_RULES,
  HARNESS_SCRIPTS,
  HARNESS_TESTS,
  isRunnerConfig,
  isRunnerTest,
  liveGlobs,
  RUNNER_CONFIGS,
  RUNNER_TESTS,
  TEST_DIRECTORIES,
  SCRIPT_ENTRIES,
  TEST_SUPPORT,
  testIncludes,
  VITE_CONFIG,
  VITE_CONFIGS,
  VITEST_TESTS,
  viteApps,
};
