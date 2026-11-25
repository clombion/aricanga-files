/**
 * Mechanics stay free of Solid: no `solid-js` or `@solidjs/*` import in the modules the `files` globs
 * name (a foundation member wholly, a system member's model: `harness/lib/oxlint-config.ts` reads them
 * from the roles). The option is required and never empty (oxlint refuses the config otherwise), and
 * the rule set with no options at all, which oxlint does not validate, throws: it never holds nothing
 * silently.
 */

import { onImports, refuse } from '#lint-rules/rules/imports.ts';
import { optionMatches, problemMeta } from '#lint-rules/ast.ts';
import type { Rule } from '#lint-rules/ast.ts';

/** The rule's options: the globs of the mechanics' modules, required and never empty, so the rule cannot hold nothing silently. */
const FILES_SCHEMA: readonly unknown[] = [
  {
    additionalProperties: false,
    properties: { files: { items: { type: 'string' }, minItems: 1, type: 'array' } },
    required: ['files'],
    type: 'object',
  },
];
const SOLID = /^(?:solid-js(?:\/|$)|@solidjs\/)/u;

export const mechanics: Rule = {
  create(context) {
    const [given] = context.options;
    if (given === undefined) {
      throw new Error('aricanga/mechanics holds nothing without its files option (harness/lib/oxlint-config.ts fills it from the roles)');
    }
    if (!optionMatches(context, 'files')) {
      return {};
    }
    return onImports((imported) => {
      if (SOLID.test(imported.source)) {
        refuse(context, imported, `mechanics import no Solid: ${imported.source} belongs in a view package`);
      }
    });
  },
  meta: problemMeta(
    'No solid-js or @solidjs/* import in a mechanics module (the `files` globs: a foundation member, a system model).',
    FILES_SCHEMA,
  ),
};
