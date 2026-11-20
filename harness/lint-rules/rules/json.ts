/** A JSON module is imported with `with { type: 'json' }`, the form the platform requires. */

import { child, children, moduleSource, nameOf, type Node, problemMeta, type Rule, text } from '../ast.ts';

function declaresJson(node: Node): boolean {
  return children(node, 'attributes').some(
    (attribute) => nameOf(child(attribute, 'key')) === 'type' && text(child(attribute, 'value') ?? attribute, 'value') === 'json',
  );
}

export const json: Rule = {
  meta: problemMeta("Import JSON with { type: 'json' }."),
  create(context) {
    return {
      ImportDeclaration(node) {
        if (moduleSource(node)?.endsWith('.json') === true && !declaresJson(node)) {
          context.report({ message: "import JSON with { type: 'json' }", node });
        }
      },
      ImportExpression(node) {
        if (moduleSource(node)?.endsWith('.json') === true && child(node, 'options') === undefined) {
          context.report({ message: "import JSON with { with: { type: 'json' } }", node });
        }
      },
    };
  },
};
