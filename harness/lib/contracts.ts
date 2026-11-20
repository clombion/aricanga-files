/**
 * The rebuild's closed contract unions, and the two ways code loses one: widening it to `string`, or
 * respelling one of its words as a bare string outside the module that owns it.
 *
 * A contract union is derived, never listed: every exported type alias of the kernel's production
 * modules that is a union of string literals, and every discriminant of an exported union of object
 * types (a property whose type is a string literal in each member). An open slot such as
 * `Effect['kind']` (`K extends string`) is not a union and is not a contract.
 */

import * as ast from 'typescript/unstable/ast';
import { type Type, TypeFlags } from 'typescript/unstable/sync';

import { nodes, pathOf, type Scan, sourceOf, textOfNode } from './checker.ts';
import { Prefixes } from './exemptions.ts';

/** The roots whose exported unions are contracts, and whose code must keep them closed. */
export const CONTRACT_ROOTS = new Prefixes(['packages/foundation/src/', 'packages/systems/']);

/** The roots whose code must name a contract word through its union, never respell it. */
export const RESPELLING_ROOTS = new Prefixes(['packages/foundation/src/', 'packages/systems/', 'experiences/sandbox/']);

/** A closed union: the module that owns it, its name, and its words. */
export interface Contract {
  readonly owner: string;
  readonly name: string;
  readonly words: ReadonlySet<string>;
}

/** A place where code loses a contract: the file, the contract, the form, and the code. */
export interface ContractSite {
  readonly path: string;
  readonly contract: string;
  readonly form: 'widened' | 'asserted' | 'respelled';
  readonly code: string;
}

function isExported(declaration: ast.TypeAliasDeclaration): boolean {
  return (declaration.modifiers ?? []).some((modifier) => modifier.kind === ast.SyntaxKind.ExportKeyword);
}

function stringLiterals(type: Type): readonly string[] | undefined {
  const members = type.isUnionType() ? (type.getTypes() ?? []) : [type];
  return members.every((member) => member.isStringLiteralType())
    ? members.map((member) => String(member.isStringLiteralType() ? member.value : ''))
    : undefined;
}

/** The contract unions the given covered paths declare. */
export function contracts(scan: Scan, paths: readonly string[]): readonly Contract[] {
  const { checker } = scan;
  const found: Contract[] = [];
  for (const path of paths.filter((candidate) => CONTRACT_ROOTS.starts(candidate))) {
    for (const statement of sourceOf(scan, path).statements) {
      if (!ast.isTypeAliasDeclaration(statement) || !isExported(statement)) {
        continue;
      }
      const symbol = checker.getSymbolAtLocation(statement.name);
      if (symbol === undefined) {
        continue;
      }
      const type = checker.getDeclaredTypeOfSymbol(symbol);
      const words = stringLiterals(type);
      if (words !== undefined && words.length > 1) {
        found.push({ owner: path, name: statement.name.text, words: new Set(words) });
        continue;
      }
      const members = type.isUnionType() ? (type.getTypes() ?? []) : [];
      const first = members[0];
      if (first === undefined || !members.every((member) => member.isObjectType())) {
        continue;
      }
      for (const property of checker.getPropertiesOfType(first)) {
        const discriminant = members.map((member) => {
          const own = checker.getPropertyOfType(member, property.name);
          const ownType = own === undefined ? undefined : checker.getTypeOfSymbol(own);
          return ownType?.isStringLiteralType() === true ? String(ownType.value) : undefined;
        });
        if (discriminant.every((word) => word !== undefined)) {
          found.push({ owner: path, name: `${statement.name.text}['${property.name}']`, words: new Set(discriminant) });
        }
      }
    }
  }
  return found;
}

/** The contract a type is: a union of at least two of one contract's words. */
function contractOf(type: Type | undefined, known: readonly Contract[]): Contract | undefined {
  const words = type === undefined ? undefined : stringLiterals(type);
  if (words === undefined || words.length < 2) {
    return undefined;
  }
  return known.find((contract) => words.every((word) => contract.words.has(word)));
}

function isPlainString(type: Type | undefined): boolean {
  return type !== undefined && (type.flags & TypeFlags.String) !== 0 && !type.isUnionType();
}

function inTypeOrImport(node: ast.Node): boolean {
  for (let current: ast.Node | undefined = node.parent; current !== undefined; current = current.parent) {
    if (ast.isTypeNode(current) || ast.isImportDeclaration(current) || ast.isExportDeclaration(current)) {
      return true;
    }
    if (ast.isSourceFile(current)) {
      return false;
    }
  }
  return false;
}

/** Whether a node is the name its parent declares or accesses, not a value. */
function names(node: ast.Node): boolean {
  const parent = node.parent;
  return 'name' in parent && parent.name === node;
}

/** The places in a covered file where a contract-typed value is widened to `string`. */
export function widenings(scan: Scan, file: ast.SourceFile, known: readonly Contract[]): readonly ContractSite[] {
  const { checker } = scan;
  const path = pathOf(file);
  const candidates = nodes(file).filter(
    (node): node is ast.Expression =>
      (ast.isIdentifier(node) || ast.isPropertyAccessExpression(node) || ast.isCallExpression(node) || ast.isElementAccessExpression(node)) &&
      !inTypeOrImport(node) &&
      !names(node),
  );
  const types = candidates.length === 0 ? [] : checker.getTypeAtLocation(candidates);
  const found: ContractSite[] = [];
  candidates.forEach((node, index) => {
    const contract = contractOf(types[index], known);
    if (contract === undefined) {
      return;
    }
    const parent = node.parent;
    if (ast.isAsExpression(parent) && parent.type.kind === ast.SyntaxKind.StringKeyword) {
      found.push({ path, contract: contract.name, form: 'asserted', code: textOfNode(parent) });
    } else if (isPlainString(checker.getContextualType(node))) {
      found.push({ path, contract: contract.name, form: 'widened', code: textOfNode(parent) });
    }
  });
  return found;
}

function holds(type: Type | undefined, word: string): boolean {
  const members = type === undefined ? [] : type.isUnionType() ? (type.getTypes() ?? []) : [type];
  return members.some((member) => member.isStringLiteralType() && member.value === word);
}

const COMPARISONS = new Set([
  ast.SyntaxKind.EqualsEqualsEqualsToken,
  ast.SyntaxKind.ExclamationEqualsEqualsToken,
  ast.SyntaxKind.EqualsEqualsToken,
  ast.SyntaxKind.ExclamationEqualsToken,
]);

/** The other side a literal is compared with, in `x === 'w'` or a `case 'w':` of `switch (x)`. */
function comparedWith(literal: ast.Node): ast.Expression | undefined {
  const parent = literal.parent;
  if (ast.isBinaryExpression(parent) && COMPARISONS.has(parent.operatorToken.kind)) {
    return parent.left === literal ? parent.right : parent.left;
  }
  if (ast.isCaseClause(parent) && ast.isCaseBlock(parent.parent) && ast.isSwitchStatement(parent.parent.parent)) {
    return parent.parent.parent.expression;
  }
  return undefined;
}

/**
 * The places in a covered file where a contract's word is written as a bare string: not contextually
 * typed by a type holding that word, and not compared with a value whose type holds it.
 */
export function respellings(scan: Scan, file: ast.SourceFile, known: readonly Contract[]): readonly ContractSite[] {
  const { checker } = scan;
  const path = pathOf(file);
  if (!RESPELLING_ROOTS.starts(path)) {
    return [];
  }
  const found: ContractSite[] = [];
  for (const node of nodes(file)) {
    if (!(ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node)) || inTypeOrImport(node)) {
      continue;
    }
    const contract = known.find((candidate) => candidate.owner !== path && candidate.words.has(node.text));
    if (contract === undefined || holds(checker.getContextualType(node), node.text)) {
      continue;
    }
    const other = comparedWith(node);
    if (other !== undefined && holds(checker.getTypeAtLocation(other), node.text)) {
      continue;
    }
    found.push({ path, contract: contract.name, form: 'respelled', code: textOfNode(node.parent) });
  }
  return found;
}
