/** No effect that only copies a value into a signal: derive it (a memo or a plain function) instead. */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { child, children, componentRule, nameOf } from '#lint-rules/ast.ts';

const EFFECTS = new Set(['createEffect', 'createRenderEffect']);
const SETTER = /^set[A-Z]/u;
const FUNCTIONS = new Set(['ArrowFunctionExpression', 'FunctionExpression']);

/**
 * The single call an effect function's body makes, if that is all it does.
 * @param {Node} fn - The effect's function.
 * @returns {Node | undefined} The call, or undefined when the body does more or something else.
 */
function onlyCall(fn: Node): Node | undefined {
  const body = child(fn, 'body');
  if (body?.type === 'CallExpression') {
    return body;
  }
  const [only, second] = body?.type === 'BlockStatement' ? children(body, 'body') : [];
  return second === undefined && only?.type === 'ExpressionStatement' ? child(only, 'expression') : undefined;
}

/**
 * The setter an effect call only calls, if its last argument is a function doing nothing else.
 * @param {Node} call - A call of an effect primitive.
 * @returns {string | undefined} The setter's name, or undefined when the effect does other work.
 */
function mirroredSetter(call: Node): string | undefined {
  const [effect] = children(call, 'arguments').toReversed();
  const inner = effect !== undefined && FUNCTIONS.has(effect.type) ? onlyCall(effect) : undefined;
  const setter = inner?.type === 'CallExpression' ? nameOf(child(inner, 'callee')) : undefined;
  return setter !== undefined && SETTER.test(setter) ? setter : undefined;
}

export const mirrors: Rule = componentRule('No effect whose only work is calling a setter; derive the value.', (context) => ({
  CallExpression(node) {
    const setter = EFFECTS.has(nameOf(child(node, 'callee')) ?? '') ? mirroredSetter(node) : undefined;
    if (setter !== undefined) {
      context.report({ message: `an effect that only calls ${setter} mirrors a value: derive it instead`, node });
    }
  },
}));
