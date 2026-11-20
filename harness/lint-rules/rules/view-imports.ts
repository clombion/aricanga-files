/** A view reads view-models, never the kernel: no `reduce` or effect types imported into a view module. */

import { type Rule, relativeFile } from '../ast.ts';
import { onImports, refuse } from './imports.ts';

const VIEW = /\/src\/view\//;
const KERNEL_NAMES = new Set(['reduce', 'Effect', 'FoundationEffect', 'ReduceResult', 'ReduceContext']);
const KERNEL_MODULES = /(^|\/)(reduce|sim\/effect|sim\/context|model\/[^/]+)(\.ts)?$/;

export const viewImports: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'A view module imports no reduce, no effect type and no model module.' },
    schema: [],
  },
  create(context) {
    if (!VIEW.test(relativeFile(context))) {
      return {};
    }
    return onImports((imported) => {
      const kernel = imported.names.filter((name) => KERNEL_NAMES.has(name));
      if (kernel.length > 0) {
        refuse(context, imported, `a view reads view-models, not the kernel: ${kernel.join(', ')}`);
      } else if (KERNEL_MODULES.test(imported.source)) {
        refuse(context, imported, `a view reads view-models, not the kernel: ${imported.source}`);
      }
    });
  },
};
