/** No hand-built DOM in a component: Solid renders, so no `replaceChildren` or `document.createElement`. */

import { child, heldComponentFile, IGNORE_SCHEMA, memberName, nameOf, type Rule } from '../ast.ts';

export const legacy: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'No replaceChildren or document.createElement in a component module.' },
    schema: IGNORE_SCHEMA,
  },
  create(context) {
    if (!heldComponentFile(context)) {
      return {};
    }
    return {
      CallExpression(node) {
        const callee = child(node, 'callee');
        if (callee === undefined) {
          return;
        }
        const name = memberName(callee);
        const fromDocument = nameOf(child(callee, 'object')) === 'document';
        if (name === 'replaceChildren' || (fromDocument && name === 'createElement')) {
          context.report({ message: `${name}: components render through JSX, not hand-built DOM`, node });
        }
      },
    };
  },
};
