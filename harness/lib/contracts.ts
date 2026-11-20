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
import { type Checker, type Type, TypeFlags } from 'typescript/unstable/sync';

import { nameText, nodes, pathOf, type Scan, sourceOf, textOfNode } from './checker.ts';
import { relative as relativeTo } from './paths.ts';
import { Prefixes } from './exemptions.ts';

/** The roots whose exported unions are contracts: the kernel's packages. */
export const CONTRACT_ROOTS = new Prefixes(['packages/foundation/src/', 'packages/systems/']);

/** A closed union: the module that owns it, its package, its name, and its words. */
export interface Contract {
  readonly owner: string;
  readonly ownerPackage: string;
  readonly name: string;
  readonly words: ReadonlySet<string>;
}

/** The package directory of a module: the path up to its `src/` (`packages/systems/chat/`). */
function packageOf(path: string): string {
  const index = path.indexOf('/src/');
  return index === -1 ? path : path.slice(0, index + 1);
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
        found.push({ owner: path, ownerPackage: packageOf(path), name: statement.name.text, words: new Set(words) });
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
          found.push({
            owner: path,
            ownerPackage: packageOf(path),
            name: `${statement.name.text}['${property.name}']`,
            words: new Set(discriminant),
          });
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

/** Whether a type holds `word`: as a literal member, or inside a type argument (an array, a set). */
function holds(checker: Checker, type: Type | undefined, word: string, depth = 0): boolean {
  if (type === undefined || depth > 3) {
    return false;
  }
  const members = type.isUnionType() ? (type.getTypes() ?? []) : [type];
  return members.some(
    (member) =>
      (member.isStringLiteralType() && member.value === word) ||
      (member.isTypeReference() && checker.getTypeArguments(member).some((argument) => holds(checker, argument, word, depth + 1))),
  );
}

const COMPARISONS = new Set([
  ast.SyntaxKind.EqualsEqualsEqualsToken,
  ast.SyntaxKind.ExclamationEqualsEqualsToken,
  ast.SyntaxKind.EqualsEqualsToken,
  ast.SyntaxKind.ExclamationEqualsToken,
]);

/** The value an expectation is about: `x` of `expect(x).matcher(...)`, through `.not` and the like. */
function expectationSubject(call: ast.CallExpression): ast.Expression | undefined {
  if (!ast.isPropertyAccessExpression(call.expression)) {
    return undefined;
  }
  let subject: ast.Expression = call.expression.expression;
  while (ast.isPropertyAccessExpression(subject)) {
    subject = subject.expression;
  }
  return ast.isCallExpression(subject) && ast.isIdentifier(subject.expression) && subject.expression.text === 'expect'
    ? subject.arguments[0]
    : undefined;
}

/** The types at a property path below `types`: a name reads a property, `[]` reads elements. */
function descend(checker: Checker, types: readonly Type[], path: readonly string[]): readonly Type[] {
  let current = types;
  for (const segment of path) {
    current = current.flatMap((type) => (type.isUnionType() ? (type.getTypes() ?? []) : [type])).flatMap((type) => {
      if (segment === '[]') {
        return type.isTypeReference() ? checker.getTypeArguments(type) : [];
      }
      const property = checker.getPropertyOfType(type, segment);
      const own = property === undefined ? undefined : checker.getTypeOfSymbol(property);
      return own === undefined ? [] : [own];
    });
  }
  return current;
}

/**
 * The types a literal is compared with: the other side of `x === 'w'`, the subject of a `switch`
 * holding `case 'w':`, or the matching part of `x` in an expectation `expect(x).matcher(arg)` where
 * the literal sits at a property path inside `arg` (`toEqual({ family: 'w' })`, `toContain('w')`).
 */
function comparedTypes(checker: Checker, literal: ast.Node): readonly Type[] {
  const parent = literal.parent;
  const typeOf = (node: ast.Node): readonly Type[] => {
    const type = checker.getTypeAtLocation(node);
    return type === undefined ? [] : [type];
  };
  if (ast.isBinaryExpression(parent) && COMPARISONS.has(parent.operatorToken.kind)) {
    return typeOf(parent.left === literal ? parent.right : parent.left);
  }
  if (ast.isCaseClause(parent) && ast.isCaseBlock(parent.parent) && ast.isSwitchStatement(parent.parent.parent)) {
    return typeOf(parent.parent.parent.expression);
  }
  const path: string[] = [];
  let node: ast.Node = literal;
  while (ast.isPropertyAssignment(node.parent) || ast.isArrayLiteralExpression(node.parent) || ast.isObjectLiteralExpression(node.parent)) {
    if (ast.isPropertyAssignment(node.parent)) {
      const name = nameText(node.parent.name);
      if (name === undefined) {
        return [];
      }
      path.unshift(name);
    } else if (ast.isArrayLiteralExpression(node.parent)) {
      path.unshift('[]');
    }
    node = node.parent;
  }
  const call = node.parent;
  if (!ast.isCallExpression(call) || !call.arguments.some((argument) => argument === node)) {
    return [];
  }
  const subject = expectationSubject(call);
  return subject === undefined ? [] : descend(checker, typeOf(subject), path);
}

/** The packages a module imports from, by where its import specifiers resolve. */
function reachedPackages(scan: Scan, file: ast.SourceFile): ReadonlySet<string> {
  const found = new Set<string>([packageOf(pathOf(file))]);
  for (const statement of file.statements) {
    if ((ast.isImportDeclaration(statement) || ast.isExportDeclaration(statement)) && statement.moduleSpecifier !== undefined) {
      for (const declaration of scan.checker.getSymbolAtLocation(statement.moduleSpecifier)?.declarations ?? []) {
        if (!declaration.path.includes('/node_modules/')) {
          found.add(packageOf(relativeTo(declaration.path)));
        }
      }
    }
  }
  return found;
}

/**
 * The places in a covered file where a contract's word is written as a bare string: in a module that
 * reaches the contract's package and owns no contract holding the word, neither contextually typed
 * by a type holding it nor compared with a value whose type holds it.
 */
export function respellings(scan: Scan, file: ast.SourceFile, known: readonly Contract[]): readonly ContractSite[] {
  const { checker } = scan;
  const path = pathOf(file);
  const reached = reachedPackages(scan, file);
  const reachable = known.filter((contract) => reached.has(contract.ownerPackage));
  const owned = known.filter((contract) => contract.owner === path);
  const found: ContractSite[] = [];
  for (const node of nodes(file)) {
    if (!(ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node)) || inTypeOrImport(node)) {
      continue;
    }
    const word = node.text;
    const contract = reachable.find((candidate) => candidate.words.has(word));
    if (
      contract === undefined ||
      owned.some((candidate) => candidate.words.has(word)) ||
      holds(checker, checker.getContextualType(node), word) ||
      comparedTypes(checker, node).some((type) => holds(checker, type, word))
    ) {
      continue;
    }
    found.push({ path, contract: contract.name, form: 'respelled', code: textOfNode(node.parent) });
  }
  return found;
}
