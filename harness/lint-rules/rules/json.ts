/** A JSON module is imported with `with { type: 'json' }`, the form the platform requires, however a module names it: an import, a re-export or an `import()`. */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { child, children, nameOf, problemMeta, text } from '#lint-rules/ast.ts';
import { onImports, refuse } from '#lint-rules/rules/imports.ts';

/**
 * Whether a declaration's attributes hold `type: 'json'`.
 * @param {Node} node - An import or re-export declaration.
 * @returns {boolean} Whether one attribute is `type: 'json'`.
 */
function declaresJson(node: Node): boolean {
  return children(node, 'attributes').some(
    (attribute) => nameOf(child(attribute, 'key')) === 'type' && text(child(attribute, 'value') ?? attribute, 'value') === 'json',
  );
}

export const json: Rule = {
  create(context) {
    return onImports((imported) => {
      if (!imported.source.endsWith('.json')) {
        return;
      }
      if (imported.node.type === 'ImportExpression') {
        if (child(imported.node, 'options') === undefined) {
          refuse(context, imported, "import JSON with { with: { type: 'json' } }");
        }
      } else if (!declaresJson(imported.node)) {
        refuse(context, imported, "import JSON with { type: 'json' }");
      }
    });
  },
  meta: problemMeta("Import JSON with { type: 'json' }."),
};
