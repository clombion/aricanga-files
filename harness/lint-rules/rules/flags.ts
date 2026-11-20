/**
 * No hand-made loading or error state in a component: a signal named for it duplicates what the
 * kernel's snapshot says and what an error boundary holds.
 */

import { child, children, heldComponentFile, IGNORE_SCHEMA, nameOf, type Rule } from '../ast.ts';

const FLAG = /^(is|has)?(loading|pending|busy|error|errored|failed|failure)$/i;
const SIGNALS = new Set(['createSignal', 'createStore']);

export const flags: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'No loading/error signal in a component; read the state from the view-model.' },
    schema: IGNORE_SCHEMA,
  },
  create(context) {
    if (!heldComponentFile(context)) {
      return {};
    }
    return {
      VariableDeclarator(node) {
        const init = child(node, 'init');
        const pattern = child(node, 'id');
        if (init?.type !== 'CallExpression' || !SIGNALS.has(nameOf(child(init, 'callee')) ?? '')) {
          return;
        }
        const first = pattern?.type === 'ArrayPattern' ? children(pattern, 'elements')[0] : pattern;
        const name = nameOf(first);
        if (name !== undefined && FLAG.test(name)) {
          context.report({
            message: `${name}: loading and error state come from the view-model or an error boundary, not a signal`,
            node,
          });
        }
      },
    };
  },
};
