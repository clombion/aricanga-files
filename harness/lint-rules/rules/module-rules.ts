/** The project rules that read a module's imports, globals and classes, by name. */

import type { Rule } from '#lint-rules/ast.ts';
import { env } from '#lint-rules/rules/env.ts';
import { json } from '#lint-rules/rules/json.ts';
import { mechanics } from '#lint-rules/rules/mechanics.ts';
import { specifier } from '#lint-rules/rules/specifier.ts';
import { statics } from '#lint-rules/rules/statics.ts';
import { storeOwner } from '#lint-rules/rules/store-owner.ts';
import { viewImports } from '#lint-rules/rules/view-imports.ts';

export const MODULE_RULES: Readonly<Record<string, Rule>> = {
  env,
  json,
  mechanics,
  specifier,
  statics,
  'store-owner': storeOwner,
  'view-imports': viewImports,
};
