/**
 * No hand-made loading or error state in a component: a signal named for it duplicates what the
 * kernel's snapshot says and what an error boundary holds.
 */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { child, children, componentRule, nameOf } from '#lint-rules/ast.ts';
import { importBindings, importedCallee } from '#lint-rules/rules/imports.ts';
import { SIGNALS } from '#lint-rules/solid.ts';

const FLAG = /^(?:is|has)?(?:loading|pending|busy|error|errored|failed|failure)$/iu;

/**
 * The name a signal or store is bound to: the first element of an array pattern, or the identifier.
 * @param {Node | undefined} pattern - The declarator's `id`.
 * @returns {string | undefined} The bound name, or undefined when there is none.
 */
function boundName(pattern: Node | undefined): string | undefined {
  if (pattern?.type !== 'ArrayPattern') {
    return nameOf(pattern);
  }
  const [first] = children(pattern, 'elements');
  return nameOf(first);
}

export const flags: Rule = componentRule('No loading/error signal in a component; read the state from the view-model.', (context) => {
  let bindings: ReadonlyMap<string, string> = new Map();
  return {
    Program(node) {
      bindings = importBindings(node);
    },
    VariableDeclarator(node) {
      const init = child(node, 'init');
      if (init?.type !== 'CallExpression' || !SIGNALS.has(importedCallee(init, bindings))) {
        return;
      }
      const name = boundName(child(node, 'id'));
      if (name !== undefined && FLAG.test(name)) {
        context.report({
          message: `${name}: loading and error state come from the view-model or an error boundary, not a signal`,
          node,
        });
      }
    },
  };
});
