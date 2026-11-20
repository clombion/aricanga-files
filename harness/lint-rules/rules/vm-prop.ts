/**
 * A part takes one prop, `vm`, through an undestructured `props`: `(props: { vm: T })` or
 * `(props: PartProps<T>)`. Reading `props.vm` keeps the prop reactive and the part replaceable.
 */

import { child, children, componentRule, nameOf, type Node, type Rule } from '../ast.ts';

const COMPONENT = /^[A-Z]/;
const FUNCTIONS = new Set(['ArrowFunctionExpression', 'FunctionExpression']);

/** Why a component's parameter list breaks the rule, or undefined when it holds. */
function problem(fn: Node): string | undefined {
  const params = children(fn, 'params');
  const [props] = params;
  if (props === undefined) {
    return undefined;
  }
  if (params.length > 1) {
    return 'a part takes one parameter, props';
  }
  if (props.type !== 'Identifier') {
    return 'a part never destructures its props: read props.vm';
  }
  const annotation = child(child(props, 'typeAnnotation') ?? props, 'typeAnnotation');
  if (annotation?.type === 'TSTypeReference' && nameOf(child(annotation, 'typeName')) === 'PartProps') {
    return undefined;
  }
  if (annotation?.type === 'TSTypeLiteral') {
    const members = children(annotation, 'members');
    if (members.length === 1 && members[0]?.type === 'TSPropertySignature' && nameOf(child(members[0], 'key')) === 'vm') {
      return undefined;
    }
  }
  return 'a part takes exactly one prop, vm: type props as { vm: T } or PartProps<T>';
}

export const vmProp: Rule = componentRule('A component takes a single undestructured props with exactly one prop, vm.', (context) => {
  const check = (name: string | undefined, fn: Node): void => {
    const why = name !== undefined && COMPONENT.test(name) ? problem(fn) : undefined;
    if (why !== undefined) {
      context.report({ message: `${name ?? ''}: ${why}`, node: fn });
    }
  };
  return {
    FunctionDeclaration(node) {
      check(nameOf(child(node, 'id')), node);
    },
    VariableDeclarator(node) {
      const init = child(node, 'init');
      if (init !== undefined && FUNCTIONS.has(init.type)) {
        check(nameOf(child(node, 'id')), init);
      }
    },
  };
});
