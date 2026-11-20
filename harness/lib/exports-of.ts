/**
 * What a module exports of its own declarations: a declaration written `export type X = …`, or one
 * named in a local export list, `export { a }` or `export type { X as Y }`. A re-export,
 * `export { a } from './b.ts'`, passes on another module's declaration and is that module's.
 */

import type { InterfaceDeclaration, SourceFile, TypeAliasDeclaration } from 'typescript/unstable/ast';
import { SyntaxKind, isExportDeclaration, isIdentifier, isNamedExports } from 'typescript/unstable/ast';

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
      names.add(isIdentifier(local) ? local.text : '');
    }
  }
  return names;
}

/**
 * Whether a type declaration is exported, by its own `export` or by a local export list.
 *
 * @param {TypeAliasDeclaration | InterfaceDeclaration} declaration - The declaration.
 * @param {Readonly<ReadonlySet<string>>} listed - The module's listed exports (`listedExports`).
 * @returns {boolean} Whether the module exports it.
 */
function isExportedType(declaration: TypeAliasDeclaration | InterfaceDeclaration, listed: Readonly<ReadonlySet<string>>): boolean {
  return (
    listed.has(declaration.name.text) ||
    (declaration.modifiers ?? []).some((modifier) => modifier.kind === SyntaxKind.ExportKeyword)
  );
}

export { isExportedType, listedExports };
