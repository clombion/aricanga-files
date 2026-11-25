/**
 * The root configuration modules the tools load, read as the tools read them: a module's default
 * export, loaded from the root. oxlint's and knip's are loaded by a literal import of the module, so
 * each reader reads the gate's own type of it (`GateOxlintConfig`, derived from oxlint's types;
 * `KnipConfig`) and never narrows it again; the gate's Vitest config is read
 * as plain values (`gate-config.ts`), its sections being Vitest's open types. Every check reads a
 * tool's computed configuration through these, never by computing it again.
 */

import type { GateOxlintConfig } from './oxlint-shape.ts';
import type { KnipConfig } from './knip-config.ts';
import { fromRoot } from './paths.ts';
import { object } from './config.ts';
import { pathToFileURL } from 'node:url';

/** A configuration's fields, as the module's default export holds them. */
type Section = Readonly<Record<string, unknown>>;

/** The root configuration modules, by the tool that loads each: the one list of them; the gate's tasks name each to its tool (`-c`, `--config`). */
const ROOT_CONFIG_MODULES = { knip: 'knip.config.ts', oxlint: 'oxlint.config.ts', vitest: 'vitest.gate.config.ts' } as const;

/** The root configuration modules. */
const ROOT_MODULES: readonly string[] = Object.values(ROOT_CONFIG_MODULES);

/**
 * A root configuration module's default export, as plain values.
 *
 * @param {string} file - The module, relative to the root.
 * @returns {Promise<Section>} Its default export's fields.
 */
async function defaultExport(file: string): Promise<Section> {
  const loaded: unknown = await import(pathToFileURL(fromRoot(file)).href);
  return object(object(loaded, `${file} module`)['default'], file);
}

/**
 * The oxlint configuration the gate's lint run loads (`ROOT_CONFIG_MODULES.oxlint`).
 *
 * @returns {Promise<GateOxlintConfig>} The configuration.
 */
async function oxlintConfig(): Promise<GateOxlintConfig> {
  const loaded = await import('#root/oxlint.config.ts');
  return loaded.default;
}

/**
 * The knip configuration the gate's unused-code scan loads (`ROOT_CONFIG_MODULES.knip`).
 *
 * @returns {Promise<KnipConfig>} The configuration.
 */
async function knipConfig(): Promise<KnipConfig> {
  const loaded = await import('#root/knip.config.ts');
  return loaded.default;
}

export { defaultExport, knipConfig, oxlintConfig, ROOT_CONFIG_MODULES, ROOT_MODULES };
