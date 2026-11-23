/**
 * The gate's Vitest config as the checks read it: `vitest.gate.config.ts` loaded from the root and
 * read as plain values, its `test` and `test.coverage` sections each an object.
 */

import { list, object, stringOf } from '#lib/config.ts';
import { fromRoot } from '#lib/paths.ts';
import { pathToFileURL } from 'node:url';

type Section = Readonly<Record<string, unknown>>;

/**
 * The gate config's default export.
 *
 * @returns {Promise<Section>} The config's fields.
 */
async function gateConfig(): Promise<Section> {
  const loaded: unknown = await import(pathToFileURL(fromRoot('vitest.gate.config.ts')).href);
  return object(object(loaded, 'vitest.gate.config.ts module')['default'], 'vitest.gate.config.ts');
}

/**
 * The gate config's `test` section.
 *
 * @returns {Promise<Section>} The section's fields.
 */
async function gateTest(): Promise<Section> {
  const config = await gateConfig();
  return object(config['test'] ?? {}, 'test');
}

/**
 * The gate config's `test.coverage` section.
 *
 * @returns {Promise<Section>} The section's fields.
 */
async function gateCoverage(): Promise<Section> {
  const test = await gateTest();
  return object(test['coverage'] ?? {}, 'coverage');
}

/**
 * The globs of one of a section's lists, each refused unless it is a string.
 *
 * @param {Section} section - The section, such as `test.coverage`.
 * @param {string} field - The list's field, such as `include`.
 * @returns {readonly string[]} Its globs.
 */
function globsOf(section: Section, field: string): readonly string[] {
  return list(section[field], field).map((glob) => stringOf(glob, `a glob of ${field}`));
}

export { gateCoverage, gateTest, globsOf };
