/**
 * A part takes one prop, `vm`, through an undestructured `props`: `(props: { vm: T })` or
 * `(props: PartProps<T>)`. Reading `props.vm` keeps the prop reactive and the part replaceable.
 */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { child, children, componentRule, nameOf } from '#lint-rules/ast.ts';
import { Accepted } from '#lint-rules/exemptions.ts';

const COMPONENT = /^[A-Z]/u;
const FUNCTIONS = new Accepted<string>(['ArrowFunctionExpression', 'FunctionExpression']);
const WRONG_TYPE = 'a part takes exactly one prop, vm: type props as { vm: T } or PartProps<T>';

/**
 * Whether a props annotation is `PartProps<T>` or a type literal with the one member `vm`.
 * @param {Node | undefined} annotation - The type of the props parameter.
 * @returns {boolean} Whether the annotation gives exactly one prop, vm.
 */
function typesOneVm(annotation: Node | undefined): boolean {
  if (annotation?.type === 'TSTypeReference') {
    return nameOf(child(annotation, 'typeName')) === 'PartProps';
  }
  if (annotation?.type !== 'TSTypeLiteral') {
    return false;
  }
  const [member, other] = children(annotation, 'members');
  return other === undefined && member?.type === 'TSPropertySignature' && nameOf(child(member, 'key')) === 'vm';
}

/**
 * Why a component's parameter list breaks the rule, or undefined when it holds.
 * @param {Node} fn - The component's function.
 * @returns {string | undefined} The problem, or undefined when the parameter list holds.
 */
function problem(fn: Node): string | undefined {
  const [props, extra] = children(fn, 'params');
  if (props === undefined) {
    return undefined;
  }
  if (extra !== undefined) {
    return 'a part takes one parameter, props';
  }
  if (props.type !== 'Identifier') {
    return 'a part never destructures its props: read props.vm';
  }
  return typesOneVm(child(child(props, 'typeAnnotation') ?? props, 'typeAnnotation')) ? undefined : WRONG_TYPE;
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
