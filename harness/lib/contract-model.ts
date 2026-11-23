/** What the contract scans share: a contract, a place code loses one, and how both are read. */

import type { Type } from 'typescript/unstable/sync';

/** A closed union: the module that owns it, its name, and its words. */
interface Contract {
  readonly owner: string;
  readonly name: string;
  readonly words: Readonly<ReadonlySet<string>>;
}

/** A place where code loses a contract: the file, the contract, the form, and the code. */
interface ContractSite {
  readonly path: string;
  readonly contract: string;
  readonly form: 'widened' | 'asserted' | 'respelled';
  readonly code: string;
}

/**
 * The words of a type that is a string literal or a union of string literals.
 *
 * @param {Type} type - The type.
 * @returns {readonly string[] | undefined} The words, or undefined when a member is no string literal.
 */
function stringLiterals(type: Readonly<Type>): readonly string[] | undefined {
  const members = type.isUnionType() ? type.getTypes() : [type];
  const words: string[] = [];
  for (const member of members) {
    if (!member.isStringLiteralType()) {
      return undefined;
    }
    words.push(member.value);
  }
  return words;
}

export { stringLiterals };
export type { Contract, ContractSite };
