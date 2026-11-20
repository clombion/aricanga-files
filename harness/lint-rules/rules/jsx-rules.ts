/** The project rules that read JSX and component modules, by name. */

import type { Rule } from '#lint-rules/ast.ts';
import { autofocus } from '#lint-rules/rules/autofocus.ts';
import { controlled } from '#lint-rules/rules/controlled.ts';
import { flags } from '#lint-rules/rules/flags.ts';
import { labels } from '#lint-rules/rules/labels.ts';
import { legacy } from '#lint-rules/rules/legacy.ts';
import { mirrors } from '#lint-rules/rules/mirrors.ts';
import { styleProp } from '#lint-rules/rules/style-prop.ts';
import { syncParts } from '#lint-rules/rules/sync-parts.ts';
import { vmProp } from '#lint-rules/rules/vm-prop.ts';

export const JSX_RULES: Readonly<Record<string, Rule>> = {
  autofocus,
  controlled,
  flags,
  labels,
  legacy,
  mirrors,
  'style-prop': styleProp,
  'sync-parts': syncParts,
  'vm-prop': vmProp,
};
