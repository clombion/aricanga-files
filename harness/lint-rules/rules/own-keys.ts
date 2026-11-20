/**
 * A record keyed by words the story writes is read through its own entries: a key can be any word,
 * `toString` and `constructor` among them, and `key in record` or `record[key] ?? fallback` then reads
 * Object.prototype's member. A non-literal `in` test is refused, and so is a defaulted or optional
 * read by a non-literal key unless an `Object.hasOwn` test of that record and key guards it.
 */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { child, children, flag, memberName, nameOf, problemMeta } from '#lint-rules/ast.ts';
import { pathOf } from '#lint-rules/closed.ts';

/** The node types whose `test` guards their first branch. */
const GUARDS = new Set(['ConditionalExpression', 'IfStatement']);

/**
 * The parent of a node, as oxlint links it.
 * @param {Node} node - The node.
 * @returns {Node | undefined} Its parent, or undefined at the root.
 */
function parentOf(node: Node): Node | undefined {
  return child(node, 'parent');
}

/**
 * Whether a key expression is literal: a string or number, which names a known member.
 * @param {Node | undefined} key - The key.
 * @returns {boolean} Whether the key is a literal.
 */
function isLiteralKey(key: Node | undefined): boolean {
  return key === undefined || key.type === 'Literal' || key.type === 'PrivateIdentifier' || key.type === 'TemplateLiteral';
}

/**
 * Whether a test is `Object.hasOwn(record, key)` for this record and key.
 * @param {Node | undefined} test - The guard's test.
 * @param {string} record - The record's path.
 * @param {string} key - The key's path.
 * @returns {boolean} Whether the test proves the entry is the record's own.
 */
function provesOwn(test: Node | undefined, record: string, key: string): boolean {
  if (test?.type !== 'CallExpression') {
    return false;
  }
  const callee = child(test, 'callee');
  const object = callee === undefined ? undefined : child(callee, 'object');
  if (callee === undefined || memberName(callee) !== 'hasOwn' || nameOf(object) !== 'Object') {
    return false;
  }
  const [first, second] = children(test, 'arguments');
  return pathOf(first) === record && pathOf(second) === key;
}

/**
 * Whether a read sits in the first branch of a guard that proves the entry is the record's own.
 * @param {Node} read - The computed member read.
 * @param {string} record - The record's path.
 * @param {string} key - The key's path.
 * @returns {boolean} Whether an enclosing `Object.hasOwn` test guards it.
 */
function guarded(read: Node, record: string, key: string): boolean {
  let inner = read;
  for (let outer = parentOf(read); outer !== undefined; outer = parentOf(outer)) {
    if (GUARDS.has(outer.type) && child(outer, 'consequent') === inner && provesOwn(child(outer, 'test'), record, key)) {
      return true;
    }
    inner = outer;
  }
  return false;
}

/**
 * The record and key paths of a computed read by a non-literal key.
 * @param {Node | undefined} node - The expression.
 * @returns {readonly [string, string] | undefined} The paths, or undefined for any other expression.
 */
function keyedRead(node: Node | undefined): readonly [string, string] | undefined {
  if (node?.type !== 'MemberExpression' || !flag(node, 'computed')) {
    return undefined;
  }
  const key = child(node, 'property');
  if (isLiteralKey(key)) {
    return undefined;
  }
  const record = pathOf(child(node, 'object'));
  const keyPath = pathOf(key);
  return record === undefined || keyPath === undefined ? undefined : [record, keyPath];
}

const MESSAGE =
  'a defaulted read by a computed key: read an array with .at(), and a record keyed by words with an Object.hasOwn guard, so toString or constructor reads nothing';

export const ownKeys: Rule = {
  create(context) {
    /**
     * Report a defaulted or optional read by a non-literal key that no own-entry test guards.
     * @param {Node | undefined} read - The read.
     */
    function check(read: Node | undefined): void {
      const paths = keyedRead(read);
      if (read !== undefined && paths !== undefined && !guarded(read, ...paths)) {
        context.report({ message: MESSAGE, node: read });
      }
    }
    return {
      BinaryExpression(node) {
        if (node['operator'] === 'in' && !isLiteralKey(child(node, 'left'))) {
          context.report({ message: 'an in test by a word the story writes: use Object.hasOwn, which ignores Object.prototype', node });
        }
      },
      LogicalExpression(node) {
        if (node['operator'] === '??') {
          check(child(node, 'left'));
        }
      },
      MemberExpression(node) {
        if (flag(node, 'optional')) {
          check(child(node, 'object'));
        }
      },
    };
  },
  meta: problemMeta('A record keyed by story words is read through its own entries: Object.hasOwn, never in or a defaulted read.'),
};
