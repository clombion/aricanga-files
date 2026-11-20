/**
 * Parts are synchronous: no `async`, `await`, promise construction, `.then`/`.catch`/`.finally` or
 * `<Loading>` in a component module. The kernel's effects carry all asynchronous work.
 */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { child, componentRule, flag, memberName, nameOf } from '#lint-rules/ast.ts';
import { jsxName } from '#lint-rules/jsx.ts';

const CHAINS = new Set(['then', 'catch', 'finally']);

export const syncParts: Rule = componentRule('No async, await, promise, .then or <Loading> in a component module.', (context) => {
  const refuse = (node: Node, what: string): void => {
    context.report({ message: `parts are synchronous: ${what}; asynchronous work is a kernel effect`, node });
  };
  const onFunction = (node: Node): void => {
    if (flag(node, 'async')) {
      refuse(node, 'an async function');
    }
  };
  return {
    ArrowFunctionExpression: onFunction,
    AwaitExpression(node) {
      refuse(node, 'await');
    },
    CallExpression(node) {
      const callee = child(node, 'callee');
      const name = callee === undefined ? undefined : memberName(callee);
      if (name !== undefined && CHAINS.has(name)) {
        refuse(node, `.${name}`);
      }
    },
    FunctionDeclaration: onFunction,
    FunctionExpression: onFunction,
    JSXOpeningElement(node) {
      if (jsxName(node) === 'Loading') {
        refuse(node, '<Loading>');
      }
    },
    MemberExpression(node) {
      if (nameOf(child(node, 'object')) === 'Promise') {
        refuse(node, `Promise.${memberName(node) ?? ''}`);
      }
    },
    NewExpression(node) {
      if (nameOf(child(node, 'callee')) === 'Promise') {
        refuse(node, 'new Promise');
      }
    },
  };
});
