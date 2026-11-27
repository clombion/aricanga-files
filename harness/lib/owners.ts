/**
 * The owner registry: for each guarded API, which module of each root may use it.
 *
 * A `Rule` names the qualified names of the declarations that make up an API and its roots (each
 * tier's members and the harness, from `owner-rules.ts`): a scoped root with its owner (the module
 * allowed to use it there, or none when no module may), or a free root, every module of which may. A
 * file's root is its holder's (`Population.holderOf`), whatever its kind.
 * The scan asks TypeScript's checker what each name resolves to, so an aliased import, a destructured
 * binding, a `globalThis.` or `window.` chain and an element access all resolve to the declaration
 * they stand for. It matches uses, never imports or types: importing a type to annotate with it is
 * not a use. It cannot see a use reached through `eval`, `Reflect.get` with a computed key, or a
 * callable passed in from outside the covered roots.
 */

import type { Identifier, Node, SourceFile } from 'typescript/unstable/ast';
import type { Root, Rule, RuleName } from './owner-rules.ts';
import {
  isBindingElement,
  isCallExpression,
  isClassDeclaration,
  isElementAccessExpression,
  isFunctionDeclaration,
  isIdentifier,
  isMethodDeclaration,
  isNewExpression,
  isObjectBindingPattern,
  isParameterDeclaration,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isPropertyDeclaration,
  isStringLiteral,
  isVariableDeclaration,
} from 'typescript/unstable/ast';
import { isPlatform, nameText, nodes, pathOf, qualifiedName } from './checker.ts';
import { rootOf, rulesOf } from './owner-rules.ts';
import type { Scan } from './checker.ts';
import type { Symbol as TsSymbol } from 'typescript/unstable/sync';
import { byKind } from './by-kind.ts';
import { holdsNoRuntimeValue } from './ts-source.ts';
import { site } from '#lint-rules/exemptions.ts';

/** One use of a guarded API outside its owner: the file it is in and the rule it breaks. */
interface Site {
  readonly path: string;
  readonly rule: RuleName;
}

/** The argument count of a `new Date()` that reads the clock. */
const NO_ARGUMENTS = 0;

/**
 * The key of a site in an exemption declaration.
 *
 * @param {Site} found - The site.
 * @returns {string} Its key.
 */
function keyOf(found: Site): string {
  return site(found.path, found.rule);
}

/**
 * Whether an identifier is the name a declaration introduces, or a property name read elsewhere.
 *
 * @param {Identifier} node - The identifier.
 * @returns {boolean} Whether it names rather than uses.
 */
function declaresOrNames(node: Identifier): boolean {
  const { parent } = node;
  const named =
    isVariableDeclaration(parent) ||
    isFunctionDeclaration(parent) ||
    isClassDeclaration(parent) ||
    isParameterDeclaration(parent) ||
    isPropertyAssignment(parent) ||
    isPropertyDeclaration(parent) ||
    isMethodDeclaration(parent) ||
    isBindingElement(parent) ||
    isPropertyAccessExpression(parent);
  return named && 'name' in parent && parent.name === node;
}

/**
 * The qualified name a symbol resolves to, when the platform declares it.
 *
 * @param {Scan} scan - The open scan.
 * @param {TsSymbol | undefined} symbol - The symbol.
 * @returns {readonly string[]} Its qualified name, or nothing.
 */
function platformName(scan: Scan, symbol: TsSymbol | undefined): readonly string[] {
  const name = isPlatform(scan.checker, symbol) ? qualifiedName(scan.checker, symbol) : undefined;
  return name === undefined ? [] : [name];
}

/**
 * Whether an expression is the platform's `Date`.
 *
 * @param {Scan} scan - The open scan.
 * @param {Node} expression - The expression.
 * @returns {boolean} Whether it resolves to `Date`.
 */
function isDate(scan: Scan, expression: Node): boolean {
  const symbol = scan.checker.getSymbolAtLocation(expression);
  return isPlatform(scan.checker, symbol) && qualifiedName(scan.checker, symbol) === 'Date';
}

/**
 * The clock reads a node makes by calling or constructing `Date` with no argument.
 *
 * @param {Scan} scan - The open scan.
 * @param {Node} node - The node.
 * @returns {readonly string[]} `new Date()` or `Date()`, or nothing.
 */
function clockReads(scan: Scan, node: Node): readonly string[] {
  if (isNewExpression(node) && (node.arguments?.length ?? NO_ARGUMENTS) === NO_ARGUMENTS && isDate(scan, node.expression)) {
    return ['new Date()'];
  }
  return isCallExpression(node) && isDate(scan, node.expression) ? ['Date()'] : [];
}

/**
 * The property `name` of the type of `holder`.
 *
 * @param {Scan} scan - The open scan.
 * @param {Node} holder - The node whose type holds the property.
 * @param {string | undefined} name - The property's name, or undefined when it is computed.
 * @returns {TsSymbol | undefined} The property's symbol, or undefined.
 */
function propertyOf(scan: Scan, holder: Node, name: string | undefined): TsSymbol | undefined {
  const type = scan.checker.getTypeAtLocation(holder);
  return name === undefined || type === undefined ? undefined : scan.checker.getPropertyOfType(type, name);
}

/**
 * The symbol a node uses: a property read, a string-keyed element read, a destructured property or a name.
 *
 * @param {Scan} scan - The open scan.
 * @param {Node} node - The node.
 * @returns {TsSymbol | undefined} The symbol, or undefined.
 */
function usedSymbol(scan: Scan, node: Node): TsSymbol | undefined {
  const { checker } = scan;
  if (isPropertyAccessExpression(node)) {
    return checker.getSymbolAtLocation(node.name);
  }
  if (isElementAccessExpression(node) && isStringLiteral(node.argumentExpression)) {
    return propertyOf(scan, node.expression, node.argumentExpression.text);
  }
  if (isBindingElement(node) && isObjectBindingPattern(node.parent)) {
    return propertyOf(scan, node.parent, nameText(node.propertyName ?? node.name));
  }
  return isIdentifier(node) && !declaresOrNames(node) ? checker.getSymbolAtLocation(node) : undefined;
}

/**
 * The qualified names every runtime use of a platform API in a file resolves to.
 *
 * @param {Scan} scan - The open scan.
 * @param {SourceFile} file - The file.
 * @returns {readonly string[]} The names.
 */
function uses(scan: Scan, file: SourceFile): readonly string[] {
  const found: string[] = [];
  for (const node of nodes(file)) {
    if (!holdsNoRuntimeValue(node)) {
      found.push(...clockReads(scan, node), ...platformName(scan, usedSymbol(scan, node)));
    }
  }
  return found;
}

/**
 * Whether the names a file uses break a rule.
 *
 * @param {Rule} rule - The rule.
 * @param {readonly string[]} found - The names the file uses.
 * @returns {boolean} Whether any is the rule's API or a member of it.
 */
function breaks(rule: Rule, found: readonly string[]): boolean {
  return found.some((name) => rule.names.has(name) || [...rule.names].some((member) => name.startsWith(`${member}.`)));
}

/**
 * Whether a root reports a use of its rule's API in a file: a scoped root, unless the file is its
 * owner; never a free root, nor a file no root holds.
 *
 * @param {Root | undefined} root - The root of the file's holder, if any.
 * @param {string} path - The file.
 * @returns {boolean} Whether a use there is a site.
 */
function reports(root: Root | undefined, path: string): boolean {
  return root !== undefined && byKind(root, { free: () => false, scoped: (scoped) => scoped.owner !== path });
}

/** A rule, with the lookup of a path's root: its holder's. */
interface Scoped {
  readonly rule: Rule;
  readonly rootOf: (target: string) => Root | undefined;
}

/**
 * The guarded uses in covered files that their rules do not allow there: the rules are the scan's
 * population's, derived once for all the files; a file's root is its holder's, and a free root
 * reports none.
 *
 * @param {Scan} scan - The open scan.
 * @param {readonly SourceFile[]} files - The files.
 * @returns {readonly Site[]} The sites.
 */
function sites(scan: Scan, files: readonly SourceFile[]): readonly Site[] {
  const lookups: readonly Scoped[] = rulesOf(scan.population).map((rule) => ({
    rootOf: rootOf(rule, scan.population),
    rule,
  }));
  return files.flatMap((file) => {
    const path = pathOf(file);
    const found = uses(scan, file);
    return lookups
      .filter((scoped: Readonly<Scoped>) => reports(scoped.rootOf(path), path) && breaks(scoped.rule, found))
      .map((scoped: Readonly<Scoped>) => ({ path, rule: scoped.rule.name }));
  });
}

/**
 * Whether a module uses the rule's API: an owner that does not is stale.
 *
 * @param {Scan} scan - The open scan.
 * @param {SourceFile} file - The module.
 * @param {Rule} rule - The rule.
 * @returns {boolean} Whether it uses the API.
 */
function ownerUses(scan: Scan, file: SourceFile, rule: Rule): boolean {
  return breaks(rule, uses(scan, file));
}

export { rulesOf, SHAPES } from './owner-rules.ts';
export { keyOf, ownerUses, sites };
export type { Site };
