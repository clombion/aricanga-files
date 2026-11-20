/** No `this` in a static member: it names the class, which a subclass or a detached call changes. */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { child, flag, problemMeta } from '#lint-rules/ast.ts';

/** The index `at` reads the innermost `this` context from. */
const INNERMOST = -1;

export const statics: Rule = {
  create(context) {
    // A stack of `this` contexts: true while `this` would be the class.
    const stack: boolean[] = [];
    const staticFunctions = new Set<Node>();
    const leave = (): void => {
      stack.pop();
    };
    const enterFunction = (node: Node): void => {
      stack.push(staticFunctions.has(node));
    };
    return {
      FunctionDeclaration: enterFunction,
      'FunctionDeclaration:exit': leave,
      FunctionExpression: enterFunction,
      'FunctionExpression:exit': leave,
      MethodDefinition(node) {
        const value = child(node, 'value');
        if (flag(node, 'static') && value !== undefined) {
          staticFunctions.add(value);
        }
      },
      PropertyDefinition(node) {
        stack.push(flag(node, 'static'));
      },
      'PropertyDefinition:exit': leave,
      StaticBlock() {
        stack.push(true);
      },
      'StaticBlock:exit': leave,
      ThisExpression(node) {
        if (stack.at(INNERMOST) === true) {
          context.report({ message: 'no this in a static member: name the class', node });
        }
      },
    };
  },
  meta: problemMeta('No this inside a static method, static field or static block; name the class.'),
};
