/** No two-argument `.then(onFulfilled, onRejected)`: a rejection handler there misses errors thrown in the first. */

import { child, children, memberName, type Rule } from '../ast.ts';

export const promises: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'No two-argument .then; chain .catch, or await in a try.' },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = child(node, 'callee');
        if (callee !== undefined && memberName(callee) === 'then' && children(node, 'arguments').length >= 2) {
          context.report({ message: 'no two-argument .then: chain .catch so it sees the first handler too', node });
        }
      },
    };
  },
};
