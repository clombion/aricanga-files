/**
 * The gate's Vitest config as the checks read it: `vitest.gate.config.ts` loaded from the root and
 * read as plain values, its `test` and `test.coverage` sections each an object.
 */

import { fromRoot } from '#lib/paths.ts';
import { object } from '#lib/config.ts';
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

export { gateCoverage, gateTest };
