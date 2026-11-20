/** No `autofocus` in either spelling: jsx-a11y's no-autofocus sees React's `autoFocus`, not Solid's. */

import { child, nameOf, type Rule } from '../ast.ts';

export const autofocus: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'No autofocus or autoFocus attribute; move focus on navigation instead.' },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (nameOf(child(node, 'name'))?.toLowerCase() === 'autofocus') {
          context.report({ message: 'no autofocus: move focus deliberately when the view changes', node });
        }
      },
    };
  },
};
