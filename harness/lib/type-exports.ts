/**
 * Exported types and their readers: an exported type a module declares is read when another module
 * names it outside an import or export declaration (a re-export passes a name on; it is not a read).
 * The readers of a production module's types are the other production modules and the harness's
 * checks, which ship the harness library's API; a test of the rebuild reading a type is not a reader.
 */

import * as ast from 'typescript/unstable/ast';
import type { Symbol as TsSymbol } from 'typescript/unstable/sync';

import { isProduction, nodes, resolved, type Scan, sourceOf } from './checker.ts';
import { Prefixes } from './exemptions.ts';

/** Modules that read the harness library's types without being production modules themselves. */
export const READER_ROOTS = new Prefixes(['harness/checks/']);

/** Whether a covered module reads exported types: a production module or a harness check. */
export function isReader(path: string): boolean {
  return isProduction(path) || READER_ROOTS.starts(path);
}

/** An exported type and whether its doc comment carries `@public`. */
interface ExportedType {
  readonly path: string;
  readonly name: string;
  readonly isPublic: boolean;
}

function exported(declaration: ast.TypeAliasDeclaration | ast.InterfaceDeclaration): boolean {
  return (declaration.modifiers ?? []).some((modifier) => modifier.kind === ast.SyntaxKind.ExportKeyword);
}

function inImportOrExport(node: ast.Node): boolean {
  for (let current: ast.Node | undefined = node.parent; current !== undefined; current = current.parent) {
    if (ast.isImportDeclaration(current) || ast.isExportDeclaration(current) || ast.isExportAssignment(current)) {
      return true;
    }
    if (ast.isSourceFile(current)) {
      return false;
    }
  }
  return false;
}

/** The exported types of the covered production modules, by symbol id. */
export function exportedTypes(scan: Scan): ReadonlyMap<number, ExportedType> {
  const found = new Map<number, ExportedType>();
  for (const path of scan.paths.filter(isProduction)) {
    for (const statement of sourceOf(scan, path).statements) {
      if ((ast.isTypeAliasDeclaration(statement) || ast.isInterfaceDeclaration(statement)) && exported(statement)) {
        const symbol = scan.checker.getSymbolAtLocation(statement.name);
        if (symbol !== undefined) {
          const isPublic = scan.checker.getJsDocTagsOfSymbol(symbol).some((tag) => tag.name === 'public');
          found.set(symbol.id, { path, name: statement.name.text, isPublic });
        }
      }
    }
  }
  return found;
}

/** For each symbol id, the covered reader modules that name it. */
export function readers(scan: Scan): ReadonlyMap<number, ReadonlySet<string>> {
  const { checker } = scan;
  const found = new Map<number, Set<string>>();
  const aliases = new Map<number, TsSymbol | undefined>();
  for (const path of scan.paths.filter(isReader)) {
    const names = nodes(sourceOf(scan, path)).filter(
      (node): node is ast.Identifier => ast.isIdentifier(node) && !inImportOrExport(node),
    );
    const symbols = names.length === 0 ? [] : checker.getSymbolAtLocation(names);
    for (const symbol of symbols) {
      if (symbol === undefined) {
        continue;
      }
      if (!aliases.has(symbol.id)) {
        aliases.set(symbol.id, resolved(checker, symbol));
      }
      const target = aliases.get(symbol.id);
      if (target !== undefined) {
        const files = found.get(target.id) ?? new Set<string>();
        files.add(path);
        found.set(target.id, files);
      }
    }
  }
  return found;
}

/** The exported types no other reader module names and that are not marked `@public`. */
export function unread(scan: Scan): readonly ExportedType[] {
  const read = readers(scan);
  return [...exportedTypes(scan)]
    .filter(([id, type]) => !type.isPublic && ![...(read.get(id) ?? [])].some((path) => path !== type.path))
    .map(([, type]) => type);
}
