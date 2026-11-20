/** Mechanics stay free of Solid: no `solid-js` or `@solidjs/*` import in the foundation or a system's model. */

import { type Rule, relativeFile } from '../ast.ts';
import { onImports, refuse } from './imports.ts';

const MECHANICS = /^packages\/(foundation\/|systems\/[^/]+\/src\/model\/)/;
const SOLID = /^(solid-js(\/|$)|@solidjs\/)/;

export const mechanics: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'No solid-js or @solidjs/* import under packages/foundation or a system model.' },
    schema: [],
  },
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
};
