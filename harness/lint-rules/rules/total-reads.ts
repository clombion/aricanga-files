/**
 * A closed set is read whole, through a total table or an exhaustive switch: no if/else-if chain
 * comparing one subject to its words one arm at a time, and no membership test against a list of its
 * words written inline (closedworld's `NON_TOTAL_READ`, its chain and membership forms).
 */

import type { Node, Rule } from '#lint-rules/ast.ts';
import { SET_FLOOR, literalStrings, pathOf, stringOf } from '#lint-rules/closed.ts';
import { child, memberName, problemMeta } from '#lint-rules/ast.ts';
import { Accepted } from '#lint-rules/exemptions.ts';

/** The equality operators an arm compares a subject to a word with. */
const EQUALITY = new Accepted<string>(['===', '==']);

/** The methods a membership test calls on a list. */
const MEMBERSHIP = new Accepted<string>(['has', 'includes']);

/** How often a subject was compared before the first arm. */
const NONE_YET = 0;

/** What one more comparison adds. */
const ONE_MORE = 1;

/**
 * The subject an `if` test compares to a string literal, if it is such a comparison.
 * @param {Node | undefined} test - The `if` statement's test.
 * @returns {string | undefined} The subject's path, or undefined for any other test.
 */
function comparedSubject(test: Node | undefined): string | undefined {
  if (test?.type !== 'BinaryExpression' || !EQUALITY.has(String(test['operator']))) {
    return undefined;
  }
  const left = child(test, 'left');
  const right = child(test, 'right');
  if (stringOf(right) !== undefined) {
    return pathOf(left);
  }
  return stringOf(left) === undefined ? undefined : pathOf(right);
}

/**
 * The `if` statements of one chain, the head first, each `else if` after it.
 * @param {Node} head - The chain's first `if`.
 * @returns {readonly Node[]} Every `if` of the chain.
 */
function chainOf(head: Node): readonly Node[] {
  const chain: Node[] = [];
  let current: Node | undefined = head;
  while (current?.type === 'IfStatement') {
    chain.push(current);
    current = child(current, 'alternate');
  }
  return chain;
}

/**
 * The subject two or more arms of a chain compare to string literals, if any.
 * @param {readonly Node[]} chain - The chain's `if` statements.
 * @returns {string | undefined} The subject, or undefined when no subject is compared twice.
 */
function repeatedSubject(chain: readonly Node[]): string | undefined {
  const counts = new Map<string, number>();
  for (const statement of chain) {
    const subject = comparedSubject(child(statement, 'test'));
    if (subject !== undefined) {
      counts.set(subject, (counts.get(subject) ?? NONE_YET) + ONE_MORE);
    }
  }
  for (const [subject, count] of counts) {
    if (count >= SET_FLOOR) {
      return subject;
    }
  }
  return undefined;
}

export const totalReads: Rule = {
  create(context) {
    const chained = new WeakSet<Node>();
    return {
      CallExpression(node) {
        const callee = child(node, 'callee');
        if (callee !== undefined && MEMBERSHIP.has(memberName(callee) ?? '') && literalStrings(child(callee, 'object')) !== undefined) {
          context.report({ message: 'a membership test against words written inline: read the closed set through a total table', node });
        }
      },
      IfStatement(node) {
        if (chained.has(node)) {
          return;
        }
        const chain = chainOf(node);
        for (const statement of chain) {
          chained.add(statement);
        }
        const subject = repeatedSubject(chain);
        if (subject !== undefined) {
          context.report({ message: `an if/else-if chain over ${subject}: switch over it exhaustively, or read a total table`, node });
        }
      },
    };
  },
  meta: problemMeta('A closed set is read through a total table or an exhaustive switch, not a chain or an inline list.'),
};
