/** No hand-built DOM in a component: Solid renders, so no `replaceChildren` or `document.createElement`. */

import { child, componentRule, memberName, nameOf } from '../ast.ts';
import type { Rule } from '../ast.ts';

export const legacy: Rule = componentRule('No replaceChildren or document.createElement in a component module.', (context) => (
  {
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
  }
));
