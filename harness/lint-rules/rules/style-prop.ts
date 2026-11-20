/** No `style` prop: the compiler writes an inline style attribute, which the CSP refuses. */

import { child, nameOf, type Rule } from '../ast.ts';

export const styleProp: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'No style prop in JSX; set dynamic values with a class or a ref.' },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (nameOf(child(node, 'name')) === 'style') {
          context.report({
            message: 'no style prop: the CSP refuses inline styles; use a class or style.setProperty from a ref',
            node,
          });
        }
      },
    };
  },
};
