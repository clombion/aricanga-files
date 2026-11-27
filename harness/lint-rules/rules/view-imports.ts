/** A view reads view-models, never the kernel: no effect or reduce types and no kernel module imported into a view module. */

import { onImports, refuse } from '#lint-rules/rules/imports.ts';
import { problemMeta, relativeFile } from '#lint-rules/ast.ts';
import { Accepted } from '#lint-rules/exemptions.ts';
import type { Rule } from '#lint-rules/ast.ts';

const VIEW = '/src/view/';
/**
 * The kernel's declarations a view may not import, by name: each one a kernel member exports, held
 * live by the project lint rules check, since a rule loaded by oxlint cannot import the kernel.
 */
const KERNEL_NAMES: Accepted<string> = new Accepted<string>(['Effect', 'ReduceResult', 'ReduceContext']);
/** A kernel module, by its specifier with any extension taken off. */
const KERNEL_MODULES = /(?:^|\/)(?:reduce|sim\/effect|sim\/context|model\/[^/]+)$/u;
/** A specifier's extension, after its last segment's last dot. */
const EXTENSION = /\.[^./]+$/u;

const viewImports: Rule = {
  create(context) {
    if (!relativeFile(context).includes(VIEW)) {
      return {};
    }
    return onImports((imported) => {
      const kernel = imported.names.filter((name) => KERNEL_NAMES.has(name));
      const [first] = kernel;
      if (first !== undefined) {
        refuse(context, imported, `a view reads view-models, not the kernel: ${kernel.join(', ')}`);
      } else if (KERNEL_MODULES.test(imported.source.replace(EXTENSION, ''))) {
        refuse(context, imported, `a view reads view-models, not the kernel: ${imported.source}`);
      }
    });
  },
  meta: problemMeta('A view module imports no reduce, no effect type and no model module.'),
};

export { KERNEL_NAMES, viewImports };
