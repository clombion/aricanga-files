/**
 * The respellings of a contract: one of its words written as a bare string, in a module that reaches
 * the contract's package and owns no contract holding the word, neither contextually typed by a type
 * holding it, nor compared with a value whose type holds it, nor a key the compiler holds: a property
 * name in an object literal whose contextual type declares that key, or an index into a value whose
 * type declares it (a table keyed by the contract, such as `{ readonly [K in Mode]: … }`).
 */

import type { CallExpression, Expression, Node, SourceFile } from 'typescript/unstable/ast';
import type { Checker, Type } from 'typescript/unstable/sync';
import type { Contract, ContractSite } from './contract-model.ts';
import {
  SyntaxKind,
  isArrayLiteralExpression,
  isBinaryExpression,
  isCallExpression,
  isCaseBlock,
  isCaseClause,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isNoSubstitutionTemplateLiteral,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isStringLiteral,
  isSwitchStatement,
} from 'typescript/unstable/ast';
import { inTypeOrImport, packageOf } from './contract-model.ts';
import { nameText, nodes, pathOf, textOfNode } from './checker.ts';
import { Accepted } from './exemptions.ts';
import type { Scan } from './checker.ts';
import { heldAsKey } from './contract-keys.ts';
import { present } from './present.ts';
import { relative as relativeTo } from './paths.ts';

/** How deep into type arguments a word is looked for. */
const MAX_DEPTH = 3;

/** The step down into a type argument. */
const ONE_LEVEL = 1;

/** The depth a search starts at. */
const TOP = 0;

/** The path segment that reads an array's elements. */
const ELEMENTS = '[]';

const COMPARISONS = new Accepted([
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken,
]);

/**
 * Whether a type holds `word`: as a literal member, or inside a type argument (an array, a set).
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {Type | undefined} type - The type.
 * @param {Readonly<{ word: string; depth: number }>} sought - The word, and how deep the search is.
 * @returns {boolean} Whether the type holds the word.
 */
function holds(checker: Readonly<Checker>, type: Type | undefined, sought: Readonly<{ word: string; depth: number }>): boolean {
  if (type === undefined || sought.depth > MAX_DEPTH) {
    return false;
  }
  const members = type.isUnionType() ? type.getTypes() : [type];
  const deeper = { depth: sought.depth + ONE_LEVEL, word: sought.word };
  return members.some(
    (member) =>
      (member.isStringLiteralType() && member.value === sought.word) ||
      (member.isTypeReference() && checker.getTypeArguments(member).some((argument) => holds(checker, argument, deeper))),
  );
}

/**
 * The value an expectation is about: `x` of `expect(x).matcher(...)`, through `.not` and the like.
 *
 * @param {CallExpression} call - The matcher's call.
 * @returns {Expression | undefined} The subject, or undefined.
 */
function expectationSubject(call: CallExpression): Expression | undefined {
  if (!isPropertyAccessExpression(call.expression)) {
    return undefined;
  }
  let subject: Expression = call.expression.expression;
  while (isPropertyAccessExpression(subject)) {
    subject = subject.expression;
  }
  if (!isCallExpression(subject) || !isIdentifier(subject.expression) || subject.expression.text !== 'expect') {
    return undefined;
  }
  const [first] = subject.arguments;
  return first;
}

/**
 * The types one segment of a property path reads below a type.
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {Type} type - The type.
 * @param {string} segment - A property name, or `[]` for an array's elements.
 * @returns {readonly Type[]} The types below.
 */
function below(checker: Readonly<Checker>, type: Type, segment: string): readonly Type[] {
  if (segment === ELEMENTS) {
    return type.isTypeReference() ? checker.getTypeArguments(type) : [];
  }
  const property = checker.getPropertyOfType(type, segment);
  const own = property === undefined ? undefined : checker.getTypeOfSymbol(property);
  return own === undefined ? [] : [own];
}

/**
 * The types at a property path below `types`: a name reads a property, `[]` reads elements.
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {readonly Type[]} types - The types the path starts at.
 * @param {readonly string[]} path - The path.
 * @returns {readonly Type[]} The types at the path's end.
 */
function descend(checker: Readonly<Checker>, types: readonly Type[], path: readonly string[]): readonly Type[] {
  let current = types;
  for (const segment of path) {
    current = current.flatMap((type) => (type.isUnionType() ? type.getTypes() : [type])).flatMap((type) => below(checker, type, segment));
  }
  return current;
}

/**
 * The type of a node, as a list.
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {Node} node - The node.
 * @returns {readonly Type[]} Its type, or nothing.
 */
function typeOf(checker: Readonly<Checker>, node: Node): readonly Type[] {
  return [present(checker.getTypeAtLocation(node), `the type of ${textOfNode(node)}`)];
}

/**
 * The path segment a literal's parent adds: a property's name, `[]` for an array's element, or
 * nothing for an object literal itself.
 *
 * @param {Node} parent - The parent.
 * @returns {readonly string[] | undefined} The segment, nothing, or undefined for a computed name.
 */
function segmentOf(parent: Node): readonly string[] | undefined {
  if (isPropertyAssignment(parent)) {
    const name = nameText(parent.name);
    return name === undefined ? undefined : [name];
  }
  return isArrayLiteralExpression(parent) ? [ELEMENTS] : [];
}

/**
 * The argument a literal sits in, and its property path there: `toEqual({ family: 'w' })` gives
 * the argument and `['family']`.
 *
 * @param {Node} literal - The literal.
 * @returns {Readonly<{ argument: Node; path: readonly string[] }> | undefined} The argument and the path, or undefined for a computed name.
 */
function argumentPath(literal: Node): Readonly<{ argument: Node; path: readonly string[] }> | undefined {
  const path: string[] = [];
  let node = literal;
  while (isPropertyAssignment(node.parent) || isArrayLiteralExpression(node.parent) || isObjectLiteralExpression(node.parent)) {
    const segment = segmentOf(node.parent);
    if (segment === undefined) {
      return undefined;
    }
    path.unshift(...segment);
    node = node.parent;
  }
  return { argument: node, path };
}

/**
 * The types the matching part of an expectation's subject has, where a literal sits in a matcher's argument.
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {Node} literal - The literal.
 * @returns {readonly Type[]} The types.
 */
function expectedTypes(checker: Readonly<Checker>, literal: Node): readonly Type[] {
  const located = argumentPath(literal);
  const call = located?.argument.parent;
  if (
    located === undefined ||
    call === undefined ||
    !isCallExpression(call) ||
    !call.arguments.some((argument) => argument === located.argument)
  ) {
    return [];
  }
  const subject = expectationSubject(call);
  return subject === undefined ? [] : descend(checker, typeOf(checker, subject), located.path);
}

/**
 * The types a literal is compared with: the other side of `x === 'w'`, the subject of a `switch`
 * holding `case 'w':`, or the matching part of `x` in an expectation `expect(x).matcher(arg)` where
 * the literal sits at a property path inside `arg` (`toEqual({ family: 'w' })`, `toContain('w')`).
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {Node} literal - The literal.
 * @returns {readonly Type[]} The types.
 */
function comparedTypes(checker: Readonly<Checker>, literal: Node): readonly Type[] {
  const { parent } = literal;
  if (isBinaryExpression(parent) && COMPARISONS.has(parent.operatorToken.kind)) {
    return typeOf(checker, parent.left === literal ? parent.right : parent.left);
  }
  if (isCaseClause(parent) && isCaseBlock(parent.parent) && isSwitchStatement(parent.parent.parent)) {
    return typeOf(checker, parent.parent.parent.expression);
  }
  return expectedTypes(checker, literal);
}

/**
 * The packages a module imports from, by where its import specifiers resolve.
 *
 * @param {Scan} scan - The open scan.
 * @param {SourceFile} file - The module.
 * @returns {ReadonlySet<string>} The packages, its own included.
 */
function reachedPackages(scan: Scan, file: SourceFile): ReadonlySet<string> {
  const found = new Set<string>([packageOf(pathOf(file))]);
  for (const statement of file.statements) {
    const specifier = isImportDeclaration(statement) || isExportDeclaration(statement) ? statement.moduleSpecifier : undefined;
    for (const declaration of specifier === undefined ? [] : (scan.checker.getSymbolAtLocation(specifier)?.declarations ?? [])) {
      if (!declaration.path.includes('/node_modules/')) {
        found.add(packageOf(relativeTo(declaration.path)));
      }
    }
  }
  return found;
}

/**
 * Whether a written word is held by what it is typed or compared with.
 *
 * @param {Readonly<Checker>} checker - The scan's checker.
 * @param {Expression} node - The literal.
 * @param {string} word - Its text.
 * @returns {boolean} Whether its context holds the word.
 */
function heldByContext(checker: Readonly<Checker>, node: Expression, word: string): boolean {
  const sought = { depth: TOP, word };
  return (
    holds(checker, checker.getContextualType(node), sought) ||
    comparedTypes(checker, node).some((type) => holds(checker, type, sought)) ||
    heldAsKey(checker, node, word)
  );
}

/**
 * The places in a covered file where a contract's word is written as a bare string.
 *
 * @param {Scan} scan - The open scan.
 * @param {SourceFile} file - The file.
 * @param {readonly Contract[]} known - The contracts.
 * @returns {readonly ContractSite[]} The places.
 */
function respellings(scan: Scan, file: SourceFile, known: readonly Contract[]): readonly ContractSite[] {
  const path = pathOf(file);
  const reached = reachedPackages(scan, file);
  const reachable = known.filter((contract) => reached.has(contract.ownerPackage));
  const owned = known.filter((contract) => contract.owner === path);
  return nodes(file).flatMap((node): ContractSite[] => {
    if (!(isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) || inTypeOrImport(node)) {
      return [];
    }
    const word = node.text;
    const contract = reachable.find((candidate) => candidate.words.has(word));
    if (contract === undefined || owned.some((candidate) => candidate.words.has(word)) || heldByContext(scan.checker, node, word)) {
      return [];
    }
    return [{ code: textOfNode(node.parent), contract: contract.name, form: 'respelled', path }];
  });
}

export { respellings };
