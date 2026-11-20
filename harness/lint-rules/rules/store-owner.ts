/** One module owns the view store: `createStore` and `reconcile` are imported only by its owners. */

import { OWNERS_SCHEMA, matches, problemMeta } from '#lint-rules/ast.ts';
import { onImports, refuse } from '#lint-rules/rules/imports.ts';
import type { Rule } from '#lint-rules/ast.ts';

const OWNED = new Set(['createStore', 'reconcile']);
const SOLID = /^solid-js(?:\/|$)/u;

export const storeOwner: Rule = {
  create(context) {
    if (matches(context, 'owners')) {
      return {};
    }
    return onImports((imported) => {
      const owned = imported.names.filter((name) => OWNED.has(name));
      const [first] = owned;
      if (SOLID.test(imported.source) && first !== undefined) {
        refuse(context, imported, `${owned.join(', ')} belong to the snapshot adapter: apply snapshots through it`);
      }
    });
  },
  meta: problemMeta('createStore and reconcile only in the snapshot adapter (the `owners` globs).', OWNERS_SCHEMA),
};
