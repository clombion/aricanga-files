/**
 * What a module exports of its own declarations: a declaration written `export type X = …`, or one
 * named in a local export list, `export { a }` or `export type { X as Y }`. A re-export,
 * `export { a } from './b.ts'`, passes on another module's declaration and is that module's. The
 * names are the ones an importer writes: a listed export by the name after its `as`.
 */

import type { InterfaceDeclaration, ModifierLike, NodeArray, SourceFile, Statement, TypeAliasDeclaration } from 'typescript/unstable/ast';
import type { Member, Population } from './scope.ts';
import {
  SyntaxKind,
  isClassDeclaration,
  isEnumDeclaration,
  isExportDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isNamedExports,
  isTypeAliasDeclaration,
  isVariableStatement,
} from 'typescript/unstable/ast';
import { isTypeScript, textsOf } from './source-files.ts';
import { isProduction } from './checker.ts';
import { parse } from './ts-source.ts';

/**
 * The local names a module's own export lists name.
 *
 * @param {SourceFile} file - The module.
 * @returns {ReadonlySet<string>} The local names, before any `as`.
 */
function listedExports(file: SourceFile): ReadonlySet<string> {
  const names = new Set<string>();
  for (const statement of file.statements) {
    const clause = isExportDeclaration(statement) && statement.moduleSpecifier === undefined ? statement.exportClause : undefined;
    for (const element of clause !== undefined && isNamedExports(clause) ? clause.elements : []) {
      const local = element.propertyName ?? element.name;
      names.add(local.text);
    }
  }
  return names;
}

/**
 * Whether a statement carries its own `export` keyword.
 *
 * @param {Readonly<NodeArray<ModifierLike>> | undefined} modifiers - The statement's modifiers.
 * @returns {boolean} Whether one is `export`.
 */
function exportedBy(modifiers: Readonly<NodeArray<ModifierLike>> | undefined): boolean {
  return (modifiers ?? []).some((modifier) => modifier.kind === SyntaxKind.ExportKeyword);
}

/**
 * Whether a type declaration is exported, by its own `export` or by a local export list.
 *
 * @param {TypeAliasDeclaration | InterfaceDeclaration} declaration - The declaration.
 * @param {Readonly<ReadonlySet<string>>} listed - The module's listed exports (`listedExports`).
 * @returns {boolean} Whether the module exports it.
 */
function isExportedType(declaration: TypeAliasDeclaration | InterfaceDeclaration, listed: Readonly<ReadonlySet<string>>): boolean {
  return listed.has(declaration.name.text) || exportedBy(declaration.modifiers);
}

/**
 * The names a statement declares, when it exports them by its own `export` keyword.
 *
 * @param {Readonly<Statement>} statement - A top-level statement.
 * @returns {readonly string[]} The names it exports.
 */
function exportedNames(statement: Readonly<Statement>): readonly string[] {
  if (isVariableStatement(statement)) {
    const names: string[] = [];
    for (const { name } of exportedBy(statement.modifiers) ? statement.declarationList.declarations : []) {
      if (isIdentifier(name)) {
        names.push(name.text);
      }
    }
    return names;
  }
  const named =
    isFunctionDeclaration(statement) ||
    isClassDeclaration(statement) ||
    isInterfaceDeclaration(statement) ||
    isTypeAliasDeclaration(statement) ||
    isEnumDeclaration(statement);
  return named && exportedBy(statement.modifiers) && statement.name !== undefined ? [statement.name.text] : [];
}

/**
 * The names a module's own export lists give its declarations, after any `as`: what an importer
 * names them.
 *
 * @param {SourceFile} file - The module.
 * @returns {readonly string[]} The exported names.
 */
function listedExportNames(file: SourceFile): readonly string[] {
  return file.statements.flatMap((statement) => {
    const clause = isExportDeclaration(statement) && statement.moduleSpecifier === undefined ? statement.exportClause : undefined;
    return clause !== undefined && isNamedExports(clause) ? clause.elements.map((element) => element.name.text) : [];
  });
}

/**
 * The names under which a module exports its own declarations: each one written with `export`, and
 * each one its local export lists name, by the name it is exported as.
 *
 * @param {SourceFile} file - The module.
 * @returns {ReadonlySet<string>} The names.
 */
function ownExports(file: SourceFile): ReadonlySet<string> {
  return new Set([...listedExportNames(file), ...file.statements.flatMap((statement) => exportedNames(statement))]);
}

/**
 * The names under which a set of modules export their own declarations (`ownExports`), over all of them.
 *
 * @param {readonly (readonly [string, string])[]} modules - Each module's path and source.
 * @returns {ReadonlySet<string>} The names.
 */
function ownExportsOf(modules: readonly (readonly [string, string])[]): ReadonlySet<string> {
  const names = new Set<string>();
  for (const [path, text] of modules) {
    for (const name of ownExports(parse(path, text))) {
      names.add(name);
    }
  }
  return names;
}

/**
 * The names under which members' shipping modules (`isProduction`: no test or test support) export
 * their own declarations: what a module outside them can import from them.
 *
 * @param {Population} held - The population.
 * @param {readonly Member[]} members - The members.
 * @returns {Promise<ReadonlySet<string>>} The names.
 */
async function shippedExportsOf(held: Population, members: readonly Member[]): Promise<ReadonlySet<string>> {
  const modules = members.flatMap((member) => held.filesOf(member)).filter((file) => isTypeScript(file) && isProduction(held, file));
  return ownExportsOf(await textsOf(modules));
}

export { isExportedType, listedExports, ownExportsOf, shippedExportsOf };
