/**
 * The closed sets the production modules declare: every type alias whose type is a union of two or
 * more string literals, by the words it holds. A set of words declared by two aliases is one closed
 * set with two owners, and a word added to one is missing from the other.
 */

import { isLiteralTypeNode, isTypeAliasDeclaration, isUnionTypeNode } from 'typescript/unstable/ast';
import { isProduction, nodes, sourceOf } from '#lib/checker.ts';
import type { Scan } from '#lib/checker.ts';
import type { TypeNode } from 'typescript/unstable/ast';
import { stringLiterals } from '#lib/contract-model.ts';

/** The fewest words a union holds before it is a closed set. */
const SET_FLOOR = 2;

/** One declaration of a closed set: the module, the alias and the set's words, sorted. */
interface DeclaredSet {
  readonly path: string;
  readonly name: string;
  readonly words: readonly string[];
}

/**
 * Whether a type is written out as a union of literals, as a set's declaration is: an alias that
 * derives its type from another (an indexed access, `Exclude`, a plain reference) restates nothing.
 *
 * @param {TypeNode} type - The alias's type.
 * @returns {boolean} Whether every member of the union is written as a literal.
 */
function isWrittenUnion(type: TypeNode): boolean {
  return isUnionTypeNode(type) && type.types.every((member) => isLiteralTypeNode(member));
}

/**
 * Every closed set a module declares.
 *
 * @param {Scan} scan - The open scan.
 * @param {string} path - The module.
 * @returns {readonly DeclaredSet[]} Its closed sets.
 */
function setsOf(scan: Scan, path: string): readonly DeclaredSet[] {
  const found: DeclaredSet[] = [];
  for (const node of nodes(sourceOf(scan, path))) {
    if (isTypeAliasDeclaration(node) && isWrittenUnion(node.type)) {
      const type = scan.checker.getTypeAtLocation(node.type);
      const words = type === undefined ? undefined : stringLiterals(type);
      if (words !== undefined && words.length >= SET_FLOOR) {
        found.push({ name: node.name.text, path, words: words.toSorted() });
      }
    }
  }
  return found;
}

/**
 * The closed sets declared more than once, as `path#name` of each declaration, by the set's words.
 *
 * @param {Scan} scan - The open scan.
 * @returns {readonly (readonly string[])[]} Each set declared twice or more: its declarations, sorted.
 */
function twiceDeclared(scan: Scan): readonly (readonly string[])[] {
  const owners = new Map<string, string[]>();
  for (const path of scan.paths.filter((file) => isProduction(file))) {
    for (const declared of setsOf(scan, path)) {
      const key = JSON.stringify(declared.words);
      owners.set(key, [...(owners.get(key) ?? []), `${declared.path}#${declared.name}`]);
    }
  }
  return [...owners.values()]
    .filter((declarations: readonly string[]) => declarations.length >= SET_FLOOR)
    .map((declarations: readonly string[]) => declarations.toSorted());
}

export { twiceDeclared };
