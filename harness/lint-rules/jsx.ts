/** The JSX helpers of the project lint rules: attributes by name, tag names, and attribute rules. */

import type { Node, Rule } from './ast.ts';
import { child, children, nameOf, problemMeta, text } from './ast.ts';

/**
 * The name of one JSX attribute (`on:input` keeps its namespace).
 * @param {Node} attribute - A `JSXAttribute`.
 * @returns {string | undefined} The attribute's name, or undefined when it has none.
 */
function attributeName(attribute: Node): string | undefined {
  const name = child(attribute, 'name');
  if (name?.type === 'JSXNamespacedName') {
    return `${nameOf(child(name, 'namespace')) ?? ''}:${nameOf(child(name, 'name')) ?? ''}`;
  }
  return nameOf(name);
}

/**
 * The JSX attributes of an opening element, by name; spread attributes are left out.
 * @param {Node} opening - A `JSXOpeningElement`.
 * @returns {ReadonlyMap<string, Node>} Each named attribute under its name.
 */
function jsxAttributes(opening: Node): ReadonlyMap<string, Node> {
  const found = new Map<string, Node>();
  for (const attribute of children(opening, 'attributes')) {
    const name = attribute.type === 'JSXAttribute' ? attributeName(attribute) : undefined;
    if (name !== undefined) {
      found.set(name, attribute);
    }
  }
  return found;
}

/**
 * The tag name of a JSX opening element (`div`, `Loading`); a member tag reads as undefined.
 * @param {Node} opening - A `JSXOpeningElement`.
 * @returns {string | undefined} The tag name, or undefined for a member or namespaced tag.
 */
function jsxName(opening: Node): string | undefined {
  const name = child(opening, 'name');
  return name?.type === 'JSXIdentifier' ? text(name, 'name') : undefined;
}

/**
 * A rule refusing every JSX attribute whose name `refused` holds.
 * @param {string} description - The rule's one-line description.
 * @param {(name: string) => boolean} refused - Whether an attribute name is refused.
 * @param {string} message - What the rule reports on a refused attribute.
 * @returns {Rule} The rule.
 */
function attributeRule(description: string, refused: (name: string) => boolean, message: string): Rule {
  return {
    create: (context) => ({
      JSXAttribute(node) {
        const name = nameOf(child(node, 'name'));
        if (name !== undefined && refused(name)) {
          context.report({ message, node });
        }
      },
    }),
    meta: problemMeta(description),
  };
}

export { attributeRule, jsxAttributes, jsxName };
