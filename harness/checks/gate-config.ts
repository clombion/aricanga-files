/**
 * The gate's Vitest config as the checks read it: `vitest.gate.config.ts` loaded from the root by
 * `gateConfig` and read as plain values by `testOf`, `coverageOf`, `projectsOf` and `globsOf`, which
 * refuse a section or list the config does not hold; and what its coverage reaches. Every check reads
 * the config through these.
 */

import { ROOT_CONFIG_MODULES, vitestConfig } from '#lib/config-modules.ts';
import { list, object, strings } from '#lib/config.ts';
import { HARNESS_CHECKS } from '#lib/test-globs.ts';
import { isProduction } from '#lib/checker.ts';
import { matches } from '#lint-rules/globs.ts';
import { normalize } from 'node:path/posix';
import { population } from '#lib/scope.ts';

type Section = Readonly<Record<string, unknown>>;

/**
 * The gate config's default export.
 *
 * @returns {Promise<Section>} The config's fields.
 */
async function gateConfig(): Promise<Section> {
  const config = await vitestConfig();
  return object(config, ROOT_CONFIG_MODULES.vitest);
}

/**
 * A Vitest config's `test` section.
 *
 * @param {Section} config - The config.
 * @returns {Section} The section's fields.
 */
function testOf(config: Section): Section {
  return object(config['test'], 'test');
}

/**
 * A `test` section's `coverage` section.
 *
 * @param {Section} test - The `test` section.
 * @returns {Section} The section's fields.
 */
function coverageOf(test: Section): Section {
  return object(test['coverage'], 'coverage');
}

/**
 * A `test` section's projects, each project's own `test` section.
 *
 * @param {Section} test - The `test` section.
 * @returns {readonly Section[]} Each project's `test` section, in order.
 */
function projectsOf(test: Section): readonly Section[] {
  return list(test['projects'], 'projects').map((project) => object(object(project, 'a project')['test'], 'a project test'));
}

/**
 * The gate config's `test` section.
 *
 * @returns {Promise<Section>} The section's fields.
 */
async function gateTest(): Promise<Section> {
  const config = await gateConfig();
  return testOf(config);
}

/**
 * The gate config's `test.coverage` section.
 *
 * @returns {Promise<Section>} The section's fields.
 */
async function gateCoverage(): Promise<Section> {
  const test = await gateTest();
  return coverageOf(test);
}

/**
 * The globs of one of a section's lists, each refused unless it is a string.
 *
 * @param {Section} section - The section, such as `test.coverage`.
 * @param {string} field - The list's field, such as `include`.
 * @returns {readonly string[]} Its globs.
 */
function globsOf(section: Section, field: string): readonly string[] {
  return strings(section[field], field);
}

/**
 * Whether the gate's coverage reads a path: its coverage `include` reaches it, and neither its
 * `exclude` nor Vitest's own exclusions take it back. Vitest leaves out its config file and its setup
 * files whatever the include says (its config resolution adds them to every coverage exclude).
 *
 * @returns {Promise<(path: string) => boolean>} The predicate over the gate config's globs.
 */
async function coverageReads(): Promise<(path: string) => boolean> {
  const test = await gateTest();
  const coverage = coverageOf(test);
  const include = globsOf(coverage, 'include');
  const setup = globsOf(test, 'setupFiles').map((file) => normalize(file));
  const exclude = [...globsOf(coverage, 'exclude'), ROOT_CONFIG_MODULES.vitest, ...setup];
  return (path: string): boolean => include.some((glob) => matches(glob, path)) && !exclude.some((glob) => matches(glob, path));
}

/**
 * Whether a module is a test, or test support coverage does not read: not production, and not covered.
 * A shipping member's `src/testing/` is test support and covered, so it may sit in a production project.
 *
 * @returns {Promise<(path: string) => boolean>} The predicate.
 */
async function testsOutsideCoverage(): Promise<(path: string) => boolean> {
  const [covered, held] = await Promise.all([coverageReads(), population()]);
  return (path: string): boolean => !isProduction(held, path) && !covered(path);
}

/**
 * The files coverage reaches: each module coverage reads, every module that is not production, which
 * coverage need not read, and the harness's own test project (`HARNESS_CHECKS`), which it does not.
 *
 * @param {readonly string[]} files - The held files.
 * @returns {Promise<ReadonlySet<string>>} The files coverage reaches.
 */
async function coverageReached(files: readonly string[]): Promise<ReadonlySet<string>> {
  const [covered, held] = await Promise.all([coverageReads(), population()]);
  return new Set(files.filter((path) => !isProduction(held, path) || path.startsWith(HARNESS_CHECKS) || covered(path)));
}

export { coverageOf, coverageReached, gateConfig, gateCoverage, gateTest, globsOf, projectsOf, testOf, testsOutsideCoverage };
