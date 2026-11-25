/**
 * The root configuration modules the tools load, read as the tools read them: a module's default
 * export, loaded from the root and narrowed as plain values. Every check reads a tool's computed
 * configuration through these, never by computing it again.
 */

import { fromRoot } from './paths.ts';
import { object } from './config.ts';
import { pathToFileURL } from 'node:url';

/** A configuration's fields, as the module's default export holds them. */
type Section = Readonly<Record<string, unknown>>;

/** The root configuration modules, by the tool that loads each: the one list of them. */
const ROOT_CONFIG_MODULES = { oxlint: 'oxlint.config.ts', vitest: 'vitest.gate.config.ts' } as const;

/** The root configuration modules. */
const ROOT_MODULES: readonly string[] = Object.values(ROOT_CONFIG_MODULES);

/**
 * A root configuration module's default export.
 *
 * @param {string} file - The module, relative to the root.
 * @returns {Promise<Section>} Its default export's fields.
 */
async function defaultExport(file: string): Promise<Section> {
  const loaded: unknown = await import(pathToFileURL(fromRoot(file)).href);
  return object(object(loaded, `${file} module`)['default'], file);
}

/**
 * The oxlint configuration the gate's lint run loads.
 *
 * @returns {Promise<Section>} Its fields.
 */
async function oxlintConfig(): Promise<Section> {
  const config = await defaultExport(ROOT_CONFIG_MODULES.oxlint);
  return config;
}

export { defaultExport, oxlintConfig, ROOT_CONFIG_MODULES, ROOT_MODULES };
