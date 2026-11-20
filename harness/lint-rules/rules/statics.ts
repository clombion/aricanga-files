/** No `this` in a static member: it names the class, which a subclass or a detached call changes. */

import { child, flag, type Node, type Rule } from '../ast.ts';

export const statics: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'No this inside a static method, static field or static block; name the class.' },
    schema: [],
  },
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
      MethodDefinition(node) {
        const value = child(node, 'value');
        if (flag(node, 'static') && value !== undefined) {
          staticFunctions.add(value);
        }
      },
      FunctionExpression: enterFunction,
      'FunctionExpression:exit': leave,
      FunctionDeclaration: enterFunction,
      'FunctionDeclaration:exit': leave,
      PropertyDefinition(node) {
        stack.push(flag(node, 'static'));
      },
      'PropertyDefinition:exit': leave,
      StaticBlock() {
        stack.push(true);
      },
      'StaticBlock:exit': leave,
      ThisExpression(node) {
        if (stack.at(-1) === true) {
          context.report({ message: 'no this in a static member: name the class', node });
        }
      },
    };
  },
};
