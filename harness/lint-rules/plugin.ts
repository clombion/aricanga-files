/**
 * The project lint rules: an oxlint JS plugin, loaded from `.oxlintrc.json` as TypeScript (Node strips
 * the types). Every rule here is turned on in the config and proven by its fixtures
 * (`harness/checks/project-lint-rules.test.ts`).
 */

import type { Rule } from './ast.ts';
import { autofocus } from './rules/autofocus.ts';
import { controlled } from './rules/controlled.ts';
import { env } from './rules/env.ts';
import { flags } from './rules/flags.ts';
import { json } from './rules/json.ts';
import { labels } from './rules/labels.ts';
import { legacy } from './rules/legacy.ts';
import { mechanics } from './rules/mechanics.ts';
import { mirrors } from './rules/mirrors.ts';
import { promises } from './rules/promises.ts';
import { statics } from './rules/statics.ts';
import { storeOwner } from './rules/store-owner.ts';
import { styleProp } from './rules/style-prop.ts';
import { syncParts } from './rules/sync-parts.ts';
import { viewImports } from './rules/view-imports.ts';
import { vmProp } from './rules/vm-prop.ts';

/** The plugin's name: its rules are `aricanga/<rule>` in the config. */
export const PLUGIN_NAME = 'aricanga';

export const RULES: Readonly<Record<string, Rule>> = {
  autofocus,
  controlled,
  env,
  flags,
  json,
  labels,
  legacy,
  mechanics,
  mirrors,
  promises,
  statics,
  'store-owner': storeOwner,
  'style-prop': styleProp,
  'sync-parts': syncParts,
  'view-imports': viewImports,
  'vm-prop': vmProp,
};

const plugin = { meta: { name: PLUGIN_NAME }, rules: RULES };

export default plugin;
