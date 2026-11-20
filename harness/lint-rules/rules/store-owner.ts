/** One module owns the view store: `createStore` and `reconcile` are imported only by its owners. */

import { matches, OWNERS_SCHEMA, problemMeta } from '../ast.ts';
import type { Rule } from '../ast.ts';
import { onImports, refuse } from './imports.ts';

const OWNED = new Set(['createStore', 'reconcile']);

export const storeOwner: Rule = {
  create(context) {
    if (matches(context, 'owners')) {
      return {};
    }
    return onImports((imported) => {
      const owned = imported.names.filter((name) => OWNED.has(name));
      if (/^solid-js(\/|$)/.test(imported.source) && owned.length > 0) {
        refuse(context, imported, `${owned.join(', ')} belong to the snapshot adapter: apply snapshots through it`);
      }
    });
  },
  meta: problemMeta('createStore and reconcile only in the snapshot adapter (the `owners` globs).', OWNERS_SCHEMA),
};
