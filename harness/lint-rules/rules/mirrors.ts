/** No effect that only copies a value into a signal: derive it (a memo or a plain function) instead. */

import { child, children, componentRule, nameOf } from '../ast.ts';
import type { Node, Rule } from '../ast.ts';

const EFFECTS = new Set(['createEffect', 'createRenderEffect']);
const SETTER = /^set[A-Z]/;
const FUNCTIONS = new Set(['ArrowFunctionExpression', 'FunctionExpression']);

/** The single call an effect function's body makes, if that is all it does. */
function onlyCall(fn: Node): Node | undefined {
  const body = child(fn, 'body');
  if (body?.type === 'CallExpression') {
    return body;
  }
  const statements = body?.type === 'BlockStatement' ? children(body, 'body') : [];
  const [only] = statements;
  return statements.length === 1 && only?.type === 'ExpressionStatement' ? child(only, 'expression') : undefined;
}

export const mirrors: Rule = componentRule('No effect whose only work is calling a setter; derive the value.', (context) => (
  {
    CallExpression(node) {
      if (!EFFECTS.has(nameOf(child(node, 'callee')) ?? '')) {
        return;
      }
      const effect = children(node, 'arguments').at(-1);
      const call = effect !== undefined && FUNCTIONS.has(effect.type) ? onlyCall(effect) : undefined;
      const setter = call?.type === 'CallExpression' ? nameOf(child(call, 'callee')) : undefined;
      if (setter !== undefined && SETTER.test(setter)) {
        context.report({ message: `an effect that only calls ${setter} mirrors a value: derive it instead`, node });
      }
    },
  }
));
