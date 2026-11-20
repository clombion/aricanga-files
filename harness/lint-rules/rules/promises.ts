/** No two-argument `.then(onFulfilled, onRejected)`: a rejection handler there misses errors thrown in the first. */

import { child, children, memberName, problemMeta } from '#lint-rules/ast.ts';
import type { Rule } from '#lint-rules/ast.ts';

export const promises: Rule = {
  create(context) {
    return {
      CallExpression(node) {
        const callee = child(node, 'callee');
        const [, onRejected] = children(node, 'arguments');
        if (callee !== undefined && memberName(callee) === 'then' && onRejected !== undefined) {
          context.report({ message: 'no two-argument .then: chain .catch so it sees the first handler too', node });
        }
      },
    };
  },
  meta: problemMeta('No two-argument .then; chain .catch, or await in a try.'),
};
