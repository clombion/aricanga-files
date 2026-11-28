/**
 * A JSON module is imported with `with { type: 'json' }`, the form the platform requires, however a
 * module names it: an import, a re-export or an `import()`. A type-only import or re-export is
 * erased, so the platform never loads the module, and TypeScript refuses an attribute on it (TS2857).
 */

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

/**
 * Whether a declaration imports or re-exports types only: `import type`, `export type`.
 * @param {Node} node - An import, a re-export or an `import()`.
 * @returns {boolean} Whether the platform never loads what it names.
 */
function typesOnly(node: Node): boolean {
  return text(node, 'importKind') === 'type' || text(node, 'exportKind') === 'type';
}

export const json: Rule = {
  create(context) {
    return onImports((imported) => {
      if (!imported.source.endsWith('.json') || typesOnly(imported.node)) {
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
