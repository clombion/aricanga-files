/** What the contract scans share: a contract, a place code loses one, and how both are read. */

import { isExportDeclaration, isImportDeclaration, isSourceFile, isTypeNode } from 'typescript/unstable/ast';
import type { Node } from 'typescript/unstable/ast';
import type { Type } from 'typescript/unstable/sync';

/** A closed union: the module that owns it, its member's directory, its name, and its words. */
interface Contract {
  readonly owner: string;
  readonly ownerPackage: string;
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

/**
 * Whether a node sits in a type, or in an import or export declaration.
 *
 * @param {Node} node - The node.
 * @returns {boolean} Whether no runtime value can be in it.
 */
function inTypeOrImport(node: Node): boolean {
  for (let current = node.parent; !isSourceFile(current); current = current.parent) {
    if (isTypeNode(current) || isImportDeclaration(current) || isExportDeclaration(current)) {
      return true;
    }
  }
  return false;
}

export { inTypeOrImport, stringLiterals };
export type { Contract, ContractSite };
