/** A view reads view-models, never the kernel: no `reduce` or effect types imported into a view module. */

import { onImports, refuse } from '#lint-rules/rules/imports.ts';
import { problemMeta, relativeFile } from '#lint-rules/ast.ts';
import type { Rule } from '#lint-rules/ast.ts';

const VIEW = '/src/view/';
const KERNEL_NAMES = new Set(['reduce', 'Effect', 'FoundationEffect', 'ReduceResult', 'ReduceContext']);
const KERNEL_MODULES = /(?:^|\/)(?:reduce|sim\/effect|sim\/context|model\/[^/]+)(?:\.ts)?$/u;

export const viewImports: Rule = {
  create(context) {
    if (!relativeFile(context).includes(VIEW)) {
      return {};
    }
    return onImports((imported) => {
      const kernel = imported.names.filter((name) => KERNEL_NAMES.has(name));
      const [first] = kernel;
      if (first !== undefined) {
        refuse(context, imported, `a view reads view-models, not the kernel: ${kernel.join(', ')}`);
      } else if (KERNEL_MODULES.test(imported.source)) {
        refuse(context, imported, `a view reads view-models, not the kernel: ${imported.source}`);
      }
    });
  },
  meta: problemMeta('A view module imports no reduce, no effect type and no model module.'),
};
