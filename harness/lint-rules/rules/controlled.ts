/**
 * JSX sets `value`, `checked` and `selected` as properties when they are bound to an expression, so
 * an element that does not handle its change would fight the user. It uses `defaultValue`,
 * `defaultChecked` or `defaultSelected` instead. A literal (`value="a"`) is template markup, an
 * attribute, and is not a binding. An `<option>`'s change is handled by its enclosing `<select>`.
 */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { child, problemMeta } from '#lint-rules/ast.ts';
import { jsxAttributes, jsxName } from '#lint-rules/jsx.ts';
import { Accepted } from '#lint-rules/exemptions.ts';

/** Each controlled property and the attribute that sets only its initial value. */
const CONTROLLED: ReadonlyMap<string, string> = new Map([
  ['checked', 'defaultChecked'],
  ['selected', 'defaultSelected'],
  ['value', 'defaultValue'],
]);
const HANDLERS = new Accepted<string>(['onInput', 'onChange', 'onClick']);

/**
 * Whether an element handles its own change.
 * @param {Node} opening - A `JSXOpeningElement`.
 * @returns {boolean} Whether it has an input, change or click handler.
 */
function handlesChange(opening: Node): boolean {
  const attributes = jsxAttributes(opening);
  return [...HANDLERS].some((handler) => attributes.has(handler));
}

/**
 * The opening element of the nearest enclosing `<select>`, if the option sits directly inside one.
 * @param {Node} opening - An `<option>`'s opening element.
 * @returns {Node | undefined} The `<select>`'s opening element, or undefined when another element encloses the option.
 */
function enclosingSelect(opening: Node): Node | undefined {
  let current = child(opening, 'parent');
  while (current !== undefined) {
    const parentOpening = current.type === 'JSXElement' ? child(current, 'openingElement') : undefined;
    if (parentOpening !== undefined && parentOpening !== opening) {
      return jsxName(parentOpening) === 'select' ? parentOpening : undefined;
    }
    current = child(current, 'parent');
  }
  return undefined;
}

/**
 * Whether an attribute is bound to an expression rather than written as a literal.
 * @param {Node} attribute - A `JSXAttribute`.
 * @returns {boolean} Whether its value is an expression container.
 */
function isBinding(attribute: Node): boolean {
  return child(attribute, 'value')?.type === 'JSXExpressionContainer';
}

export const controlled: Rule = {
  create(context) {
    return {
      JSXOpeningElement(node) {
        const owner = jsxName(node) === 'option' ? enclosingSelect(node) : node;
        if (owner !== undefined && handlesChange(owner)) {
          return;
        }
        const attributes = jsxAttributes(node);
        for (const [name, fallback] of CONTROLLED) {
          const attribute = attributes.get(name);
          if (attribute !== undefined && isBinding(attribute)) {
            context.report({
              message: `${name} is a property: handle the change (onInput/onChange) or use ${fallback}`,
              node: attribute,
            });
          }
        }
      },
    };
  },
  meta: problemMeta('A bound value/checked/selected only on an element that handles its change.'),
};
