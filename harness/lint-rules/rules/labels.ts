/**
 * A `<label>` names its control with Solid's `for`, or wraps the control. jsx-a11y's
 * label-has-associated-control knows only React's `htmlFor` and has no option for `for`.
 */

import { child, children, jsxAttributes, jsxName, problemMeta } from '../ast.ts';
import type { Node, Rule } from '../ast.ts';

const CONTROLS = new Set(['input', 'select', 'textarea', 'meter', 'output', 'progress']);
const DEPTH = 2;

function wrapsControl(element: Node, depth: number): boolean {
  return children(element, 'children').some((inner) => {
    if (inner.type !== 'JSXElement') {
      return false;
    }
    const opening = child(inner, 'openingElement');
    const name = opening === undefined ? undefined : jsxName(opening);
    return (name !== undefined && CONTROLS.has(name)) || (depth > 1 && wrapsControl(inner, depth - 1));
  });
}

export const labels: Rule = {
  create(context) {
    return {
      JSXElement(node) {
        const opening = child(node, 'openingElement');
        if (opening === undefined || jsxName(opening) !== 'label') {
          return;
        }
        const attributes = jsxAttributes(opening);
        if (attributes.has('htmlFor')) {
          context.report({ message: 'Solid spells it for, not htmlFor', node: opening });
        } else if (!attributes.has('for') && !wrapsControl(node, DEPTH)) {
          context.report({ message: 'a label names its control with for, or wraps it', node: opening });
        }
      },
    };
  },
  meta: problemMeta('A label has `for` or wraps its control; `htmlFor` is the React spelling.'),
};
