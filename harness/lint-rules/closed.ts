/**
 * The readers the closed-set rules share: a subject's dotted path, a string literal's value, and a
 * literal list of strings, so that two arms or two reads are compared by what they name.
 */

import { child, children, flag, nameOf, text } from '#lint-rules/ast.ts';
import { Accepted } from '#lint-rules/exemptions.ts';
import type { Node } from '#lint-rules/ast.ts';

/** The fewest members a restated set or a chain names before it reads a closed set. */
const SET_FLOOR = 2;

/** The wrappers a literal list may sit in and still be the list it wraps. */
const LIST_WRAPPERS = new Accepted<string>(['TSAsExpression', 'TSSatisfiesExpression']);

/**
 * The value of a string literal.
 * @param {Node | undefined} node - The expression.
 * @returns {string | undefined} The string, or undefined when the node is no string literal.
 */
function stringOf(node: Node | undefined): string | undefined {
  return node?.type === 'Literal' ? text(node, 'value') : undefined;
}

/**
 * The name the root of a member chain stands for: an identifier, or `this`.
 * @param {Node | undefined} node - The chain's root.
 * @returns {string | undefined} Its name, or undefined for any other expression.
 */
function rootName(node: Node | undefined): string | undefined {
  if (node?.type === 'ThisExpression') {
    return 'this';
  }
  return node?.type === 'Identifier' ? nameOf(node) : undefined;
}

/**
 * The dotted path of a static chain, such as `message.chatId`: identifiers joined by static members.
 * @param {Node | undefined} node - The expression.
 * @returns {string | undefined} Its path, or undefined when a member is computed or the root is no name.
 */
function staticPath(node: Node | undefined): string | undefined {
  const names: string[] = [];
  let current = node;
  while (current?.type === 'MemberExpression' && !flag(current, 'computed')) {
    const name = nameOf(child(current, 'property'));
    if (name === undefined) {
      return undefined;
    }
    names.unshift(name);
    current = child(current, 'object');
  }
  const root = rootName(current);
  return root === undefined ? undefined : [root, ...names].join('.');
}

/**
 * The path an expression names: a static chain, or a static chain read by a static key, such as
 * `state.messageHistory[message.chatId]`.
 * @param {Node | undefined} node - The expression.
 * @returns {string | undefined} Its path, or undefined for any other expression.
 */
function pathOf(node: Node | undefined): string | undefined {
  if (node?.type !== 'MemberExpression' || !flag(node, 'computed')) {
    return staticPath(node);
  }
  const object = staticPath(child(node, 'object'));
  const property = child(node, 'property');
  const key = staticPath(property) ?? stringOf(property);
  return object === undefined || key === undefined ? undefined : `${object}[${key}]`;
}

/**
 * The strings an array literal holds, when every element is a string literal.
 * @param {Node} array - An `ArrayExpression`.
 * @returns {readonly string[] | undefined} The strings, or undefined when one element is no string literal.
 */
function arrayStrings(array: Node): readonly string[] | undefined {
  const found: string[] = [];
  for (const element of children(array, 'elements')) {
    const value = stringOf(element);
    if (value === undefined) {
      return undefined;
    }
    found.push(value);
  }
  return found.length >= SET_FLOOR ? found : undefined;
}

/**
 * The strings a literal list holds: an array of string literals, or `new Set` of one.
 * @param {Node | undefined} node - The expression.
 * @returns {readonly string[] | undefined} The strings, or undefined when the node is no such list.
 */
function literalStrings(node: Node | undefined): readonly string[] | undefined {
  if (node !== undefined && LIST_WRAPPERS.has(node.type)) {
    return literalStrings(child(node, 'expression'));
  }
  if (node?.type === 'NewExpression' && nameOf(child(node, 'callee')) === 'Set') {
    const [first] = children(node, 'arguments');
    return literalStrings(first);
  }
  return node?.type === 'ArrayExpression' ? arrayStrings(node) : undefined;
}

export { SET_FLOOR, literalStrings, pathOf, stringOf };
