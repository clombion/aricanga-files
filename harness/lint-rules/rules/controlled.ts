/**
 * JSX sets `value`, `checked` and `selected` as properties when they are bound to an expression, so
 * an element that does not handle its change would fight the user. It uses `defaultValue`,
 * `defaultChecked` or `defaultSelected` instead. A literal (`value="a"`) is template markup, an
 * attribute, and is not a binding. An `<option>`'s change is handled by its enclosing `<select>`.
 */

import { child, jsxAttributes, jsxName, type Node, problemMeta, type Rule } from '../ast.ts';

const CONTROLLED = ['value', 'checked', 'selected'];
const HANDLERS = ['onInput', 'onChange', 'onClick', 'on:input', 'on:change', 'on:click'];

function handlesChange(opening: Node): boolean {
  const attributes = jsxAttributes(opening);
  return HANDLERS.some((handler) => attributes.has(handler));
}

/** The opening element of the nearest enclosing `<select>`, if the option sits directly inside one. */
function enclosingSelect(opening: Node): Node | undefined {
  let current = child(opening, 'parent');
  while (current !== undefined) {
    if (current.type === 'JSXElement') {
      const parentOpening = child(current, 'openingElement');
      if (parentOpening !== undefined && parentOpening !== opening) {
        return jsxName(parentOpening) === 'select' ? parentOpening : undefined;
      }
    }
    current = child(current, 'parent');
  }
  return undefined;
}

function isBinding(attribute: Node): boolean {
  return child(attribute, 'value')?.type === 'JSXExpressionContainer';
}

export const controlled: Rule = {
  meta: problemMeta('A bound value/checked/selected only on an element that handles its change.'),
  create(context) {
    return {
      JSXOpeningElement(node) {
        const owner = jsxName(node) === 'option' ? enclosingSelect(node) : node;
        if (owner !== undefined && handlesChange(owner)) {
          return;
        }
        const attributes = jsxAttributes(node);
        for (const name of CONTROLLED) {
          const attribute = attributes.get(name);
          if (attribute !== undefined && isBinding(attribute)) {
            const fallback = `default${name[0]?.toUpperCase() ?? ''}${name.slice(1)}`;
            context.report({
              message: `${name} is a property: handle the change (onInput/onChange) or use ${fallback}`,
              node: attribute,
            });
          }
        }
      },
    };
  },
};
