/**
 * The keys a contract's word may be written as without respelling it: where the compiler holds the
 * word as a key its owner's type declares.
 */

import { isElementAccessExpression, isObjectLiteralExpression, isPropertyAssignment } from 'typescript/unstable/ast';
import type { Checker } from 'typescript/unstable/sync';
import type { Expression } from 'typescript/unstable/ast';

/**
 * Whether a written word is a key the compiler holds: the name of a property in an object literal
 * whose contextual type declares that key, or the index of an element access into a value whose type
 * declares it. A type with only an index signature declares no key, so a word keyed into a
 * `Record<string, …>` stays a respelling.
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {Expression} node - The literal.
 * @param {string} word - Its text.
 * @returns {boolean} Whether the word is a key its owner's type declares.
 */
function heldAsKey(checker: Readonly<Checker>, node: Expression, word: string): boolean {
  const { parent } = node;
  if (isPropertyAssignment(parent) && parent.name === node && isObjectLiteralExpression(parent.parent)) {
    const keyed = checker.getContextualType(parent.parent);
    return keyed !== undefined && checker.getPropertyOfType(keyed, word) !== undefined;
  }
  if (isElementAccessExpression(parent) && parent.argumentExpression === node) {
    const keyed = checker.getTypeAtLocation(parent.expression);
    return keyed !== undefined && checker.getPropertyOfType(keyed, word) !== undefined;
  }
  return false;
}

export { heldAsKey };
