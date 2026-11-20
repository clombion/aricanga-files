/**
 * JSX sets `value`, `checked` and `selected` as properties, so an element that does not handle its
 * change would fight the user. It uses `defaultValue`, `defaultChecked` or `defaultSelected` instead.
 */

import { jsxAttributes, type Rule } from '../ast.ts';

const CONTROLLED = ['value', 'checked', 'selected'];
const HANDLERS = ['onInput', 'onChange', 'onClick', 'on:input', 'on:change', 'on:click'];

export const controlled: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'value/checked/selected only on an element that handles its change.' },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const attributes = jsxAttributes(node);
        if (HANDLERS.some((handler) => attributes.has(handler))) {
          return;
        }
        for (const name of CONTROLLED) {
          const attribute = attributes.get(name);
          if (attribute !== undefined) {
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
