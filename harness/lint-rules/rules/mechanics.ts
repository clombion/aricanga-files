/**
 * Mechanics stay free of Solid: no `solid-js` or `@solidjs/*` import in the modules the `files` globs
 * name (a foundation member wholly, a system member's model: `harness/lib/oxlint-config.ts` reads them
 * from the roles).
 */

import { matches, problemMeta } from '#lint-rules/ast.ts';
import { onImports, refuse } from '#lint-rules/rules/imports.ts';
import type { Rule } from '#lint-rules/ast.ts';

/** The rule's options: the globs of the mechanics' modules. */
const FILES_SCHEMA: readonly unknown[] = [
  { additionalProperties: false, properties: { files: { items: { type: 'string' }, type: 'array' } }, type: 'object' },
];
const SOLID = /^(?:solid-js(?:\/|$)|@solidjs\/)/u;

export const mechanics: Rule = {
  create(context) {
    if (!matches(context, 'files')) {
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
