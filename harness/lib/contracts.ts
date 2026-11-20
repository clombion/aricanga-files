/**
 * The rebuild's closed contract unions, and the two ways code loses one: widening it to `string`, or
 * respelling one of its words as a bare string outside the module that owns it
 * (`contract-respellings.ts`).
 *
 * A contract union is derived, never listed: every exported type alias of the kernel's production
 * modules (by its own `export` or in the module's export list) that is a union of string literals,
 * and every discriminant of an exported union of object types (a property whose type is a string
 * literal in each member). An open slot such as `Effect['kind']` (`K extends string`) is not a union
 * and is not a contract.
 */

import type { Checker, Type } from 'typescript/unstable/sync';
import type { Contract, ContractSite } from './contract-model.ts';
import type { Expression, Node, SourceFile, TypeAliasDeclaration } from 'typescript/unstable/ast';
import {
  SyntaxKind,
  isAsExpression,
  isCallExpression,
  isElementAccessExpression,
  isIdentifier,
  isPropertyAccessExpression,
  isTypeAliasDeclaration,
} from 'typescript/unstable/ast';
import { inTypeOrImport, packageOf, stringLiterals } from './contract-model.ts';
import { isExportedType, listedExports } from './exports-of.ts';
import { nodes, pathOf, sourceOf, textOfNode } from './checker.ts';
import { Prefixes } from './exemptions.ts';
import type { Scan } from './checker.ts';
import { isEmpty } from './lists.ts';

/** The roots whose exported unions are contracts: the kernel's packages. */
const CONTRACT_ROOTS: Prefixes = new Prefixes(['packages/foundation/src/', 'packages/systems/']);

/** The fewest words a union holds to be a contract. */
const LEAST_WORDS = 2;

/**
 * The discriminants of a union of object types, each as a contract.
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {Type} type - The union.
 * @param {Readonly<{ name: string; path: string }>} declared - The union's name and module.
 * @returns {readonly Contract[]} A contract per discriminant.
 */
function discriminants(checker: Readonly<Checker>, type: Type, declared: Readonly<{ name: string; path: string }>): readonly Contract[] {
  const members = type.isUnionType() ? type.getTypes() : [];
  const [first] = members;
  if (first === undefined || !members.every((member) => member.isObjectType())) {
    return [];
  }
  return checker.getPropertiesOfType(first).flatMap((property) => {
    const words = members.map((member) => {
      const own = checker.getPropertyOfType(member, property.name);
      const ownType = own === undefined ? undefined : checker.getTypeOfSymbol(own);
      return ownType?.isStringLiteralType() === true ? ownType.value : undefined;
    });
    const complete = words.flatMap((word) => (word === undefined ? [] : [word]));
    return complete.length === words.length
      ? [
          {
            name: `${declared.name}['${property.name}']`,
            owner: declared.path,
            ownerPackage: packageOf(declared.path),
            words: new Set(complete),
          },
        ]
      : [];
  });
}

/**
 * The contracts one exported type alias declares.
 *
 * @param {Scan} scan - The open scan.
 * @param {TypeAliasDeclaration} statement - The type alias.
 * @param {string} path - Its module.
 * @returns {readonly Contract[]} Its contracts: the union itself, or its discriminants.
 */
function contractsOf(scan: Scan, statement: TypeAliasDeclaration, path: string): readonly Contract[] {
  const symbol = scan.checker.getSymbolAtLocation(statement.name);
  if (symbol === undefined) {
    return [];
  }
  const type = scan.checker.getDeclaredTypeOfSymbol(symbol);
  const words = stringLiterals(type);
  if (words !== undefined && words.length >= LEAST_WORDS) {
    return [{ name: statement.name.text, owner: path, ownerPackage: packageOf(path), words: new Set(words) }];
  }
  return discriminants(scan.checker, type, { name: statement.name.text, path });
}

/**
 * The contract unions the given covered paths declare.
 *
 * @param {Scan} scan - The open scan.
 * @param {readonly string[]} paths - The covered paths to read.
 * @returns {readonly Contract[]} The contracts.
 */
function contracts(scan: Scan, paths: readonly string[]): readonly Contract[] {
  return paths
    .filter((candidate) => CONTRACT_ROOTS.starts(candidate))
    .flatMap((path) => {
      const file = sourceOf(scan, path);
      const listed = listedExports(file);
      return file.statements.flatMap((statement) =>
        isTypeAliasDeclaration(statement) && isExportedType(statement, listed) ? contractsOf(scan, statement, path) : [],
      );
    });
}

/**
 * The contract a type is: a union of at least two of one contract's words.
 *
 * @param {Type | undefined} type - The type.
 * @param {readonly Contract[]} known - The contracts.
 * @returns {Contract | undefined} The contract, or undefined.
 */
function contractOf(type: Type | undefined, known: readonly Contract[]): Contract | undefined {
  const words = type === undefined ? undefined : stringLiterals(type);
  if (words === undefined || words.length < LEAST_WORDS) {
    return undefined;
  }
  return known.find((contract) => words.every((word) => contract.words.has(word)));
}

/**
 * Whether a type is `string` itself.
 *
 * @param {Type | undefined} type - The type.
 * @returns {boolean} Whether it is the plain `string` type.
 */
function isPlainString(type: Type | undefined): boolean {
  return type !== undefined && type.isIntrinsicType() && type.intrinsicName === 'string';
}

/**
 * Whether a node is the name its parent declares or accesses, not a value.
 *
 * @param {Node} node - The node.
 * @returns {boolean} Whether it names.
 */
function names(node: Node): boolean {
  const { parent } = node;
  return 'name' in parent && parent.name === node;
}

/**
 * Whether a node is an expression a contract-typed value can be read through.
 *
 * @param {Node} node - The node.
 * @returns {boolean} Whether it is a candidate for widening.
 */
function isCandidate(node: Node): node is Expression {
  return (
    (isIdentifier(node) || isPropertyAccessExpression(node) || isCallExpression(node) || isElementAccessExpression(node)) &&
    !inTypeOrImport(node) &&
    !names(node)
  );
}

/**
 * How a contract-typed expression loses its contract, if it does.
 *
 * @param {Scan} scan - The open scan.
 * @param {Expression} node - The expression.
 * @returns {ContractSite['form'] | undefined} `asserted`, `widened`, or undefined.
 */
function lossOf(scan: Scan, node: Expression): ContractSite['form'] | undefined {
  const { parent } = node;
  if (isAsExpression(parent) && parent.type.kind === SyntaxKind.StringKeyword) {
    return 'asserted';
  }
  return isPlainString(scan.checker.getContextualType(node)) ? 'widened' : undefined;
}

/**
 * The places in a covered file where a contract-typed value is widened to `string`.
 *
 * @param {Scan} scan - The open scan.
 * @param {SourceFile} file - The file.
 * @param {readonly Contract[]} known - The contracts.
 * @returns {readonly ContractSite[]} The places.
 */
function widenings(scan: Scan, file: SourceFile, known: readonly Contract[]): readonly ContractSite[] {
  const path = pathOf(file);
  const candidates = nodes(file).filter((node) => isCandidate(node));
  const types = isEmpty(candidates) ? [] : scan.checker.getTypeAtLocation(candidates);
  return candidates.flatMap((node, index) => {
    const contract = contractOf(types[index], known);
    const form = contract === undefined ? undefined : lossOf(scan, node);
    return contract === undefined || form === undefined ? [] : [{ code: textOfNode(node.parent), contract: contract.name, form, path }];
  });
}

export { respellings } from './contract-respellings.ts';
export type { Contract, ContractSite } from './contract-model.ts';
export { contracts, widenings };
