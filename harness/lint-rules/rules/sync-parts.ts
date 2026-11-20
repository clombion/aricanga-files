/**
 * Parts are synchronous: no `async`, `await`, promise construction, `.then`/`.catch`/`.finally` or
 * `<Loading>` in a component module. The kernel's effects carry all asynchronous work.
 */

import { child, flag, heldComponentFile, IGNORE_SCHEMA, jsxName, memberName, nameOf, type Node, type Rule } from '../ast.ts';

const CHAINS = new Set(['then', 'catch', 'finally']);

export const syncParts: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'No async, await, promise, .then or <Loading> in a component module.' },
    schema: IGNORE_SCHEMA,
  },
  create(context) {
    if (!heldComponentFile(context)) {
      return {};
    }
    const refuse = (node: Node, what: string): void => {
      context.report({ message: `parts are synchronous: ${what}; asynchronous work is a kernel effect`, node });
    };
    const onFunction = (node: Node): void => {
      if (flag(node, 'async')) {
        refuse(node, 'an async function');
      }
    };
    return {
      FunctionDeclaration: onFunction,
      FunctionExpression: onFunction,
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
      NewExpression(node) {
        if (nameOf(child(node, 'callee')) === 'Promise') {
          refuse(node, 'new Promise');
        }
      },
      MemberExpression(node) {
        if (nameOf(child(node, 'object')) === 'Promise') {
          refuse(node, `Promise.${memberName(node) ?? ''}`);
        }
      },
      JSXOpeningElement(node) {
        if (jsxName(node) === 'Loading') {
          refuse(node, '<Loading>');
        }
      },
    };
  },
};
