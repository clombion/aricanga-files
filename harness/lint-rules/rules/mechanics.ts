/** Mechanics stay free of Solid: no `solid-js` or `@solidjs/*` import in the foundation or a system's model. */

import { onImports, refuse } from '#lint-rules/rules/imports.ts';
import { problemMeta, relativeFile } from '#lint-rules/ast.ts';
import type { Rule } from '#lint-rules/ast.ts';

const MECHANICS = /^packages\/(?:foundation\/|systems\/[^/]+\/src\/model\/)/u;
const SOLID = /^(?:solid-js(?:\/|$)|@solidjs\/)/u;

export const mechanics: Rule = {
  create(context) {
    if (!MECHANICS.test(relativeFile(context))) {
      return {};
    }
    return onImports((imported) => {
      if (SOLID.test(imported.source)) {
        refuse(context, imported, `mechanics import no Solid: ${imported.source} belongs in a view package`);
      }
    });
  },
  meta: problemMeta('No solid-js or @solidjs/* import under packages/foundation or a system model.'),
};
