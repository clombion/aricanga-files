/**
 * The root configuration modules the tools load, read as the tools read them: a module's default
 * export, loaded from the root by a literal import of the module, so each is in the harness's
 * TypeScript project, type-checked under its options, and each reader reads the module's own type of
 * it (`GateOxlintConfig`, derived from oxlint's types; `KnipConfig`, from knip's; Vitest's
 * `ViteUserConfig`) and never narrows it again. The gate's Vitest config is then read as plain values
 * (`gate-config.ts`), its sections being Vitest's open types. Every check reads a tool's computed
 * configuration through these, never by computing it again.
 */

import type { GateOxlintConfig } from './oxlint-shape.ts';
import type { KnipConfig } from './knip-config.ts';
import type { ViteUserConfig } from 'vitest/config';

/** The root configuration modules, by the tool that loads each: the one list of them; the gate's tasks name each to its tool (`-c`, `--config`). */
const ROOT_CONFIG_MODULES = { knip: 'knip.config.ts', oxlint: 'oxlint.config.ts', vitest: 'vitest.gate.config.ts' } as const;

/** The root configuration modules. */
const ROOT_MODULES: readonly string[] = Object.values(ROOT_CONFIG_MODULES);

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

/**
 * The Vitest configuration the gate's test run loads (`ROOT_CONFIG_MODULES.vitest`).
 *
 * @returns {Promise<ViteUserConfig>} The configuration.
 */
async function vitestConfig(): Promise<ViteUserConfig> {
  const loaded = await import('#root/vitest.gate.config.ts');
  return loaded.default;
}

export { knipConfig, oxlintConfig, ROOT_CONFIG_MODULES, ROOT_MODULES, vitestConfig };
