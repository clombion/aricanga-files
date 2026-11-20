/**
 * A `<label>` names its control with Solid's `for`, or wraps the control. jsx-a11y's
 * label-has-associated-control knows only React's `htmlFor` and has no option for `for`.
 */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { child, children, problemMeta } from '#lint-rules/ast.ts';
import { jsxAttributes, jsxName } from '#lint-rules/jsx.ts';

const CONTROLS = new Set(['input', 'select', 'textarea', 'meter', 'output', 'progress']);
/** How many elements deep a wrapped control may sit inside its label. */
const DEPTH = 2;
/** The depth below which no further level is searched. */
const LAST_LEVEL = 1;

/**
 * Whether an element is one of the controls a label names.
 * @param {Node} element - A `JSXElement`.
 * @returns {boolean} Whether its tag is a control.
 */
function isControl(element: Node): boolean {
  const opening = child(element, 'openingElement');
  const name = opening === undefined ? undefined : jsxName(opening);
  return name !== undefined && CONTROLS.has(name);
}

/**
 * Whether an element wraps a control within `depth` levels.
 * @param {Node} element - A `JSXElement`.
 * @param {number} depth - How many levels to search.
 * @returns {boolean} Whether a control sits within those levels.
 */
function wrapsControl(element: Node, depth: number): boolean {
  return children(element, 'children').some(
    (inner) => inner.type === 'JSXElement' && (isControl(inner) || (depth > LAST_LEVEL && wrapsControl(inner, depth - LAST_LEVEL))),
  );
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
