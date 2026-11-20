/**
 * The project lint rules: an oxlint JS plugin, loaded from `.oxlintrc.json` as TypeScript (Node strips
 * the types). Every rule here is turned on in the config and proven by its fixtures
 * (`harness/checks/project-lint-rules.test.ts`).
 */

import { JSX_RULES } from '#lint-rules/rules/jsx-rules.ts';
import { MODULE_RULES } from '#lint-rules/rules/module-rules.ts';
import type { Rule } from '#lint-rules/ast.ts';

/** The plugin's name: its rules are `aricanga/<rule>` in the config. */
const PLUGIN_NAME = 'aricanga';

/** Every project rule, by the name the config turns it on under. */
const RULES: Readonly<Record<string, Rule>> = { ...JSX_RULES, ...MODULE_RULES };

/** The plugin oxlint loads: its name and its rules. */
interface Plugin {
  readonly meta: { readonly name: string };
  readonly rules: typeof RULES;
}

const plugin: Plugin = { meta: { name: PLUGIN_NAME }, rules: RULES };

export { PLUGIN_NAME, RULES };
export default plugin;
