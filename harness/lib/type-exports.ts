/**
 * Exported types and their readers: an exported type a module declares (by its own `export` or in
 * the module's export list) is read when another module names it outside an import or export
 * declaration (a re-export passes a name on; it is not a read).
 * A production module's types are read by other production modules and by the harness's checks,
 * which ship the harness library's API: a type only a test names is exported for the test alone. A
 * test-support module's types are read by any other module.
 */

import type { Checker, Symbol as TsSymbol } from 'typescript/unstable/sync';
import type { Identifier, Node } from 'typescript/unstable/ast';
import {
  isExportAssignment,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isInterfaceDeclaration,
  isSourceFile,
  isTypeAliasDeclaration,
} from 'typescript/unstable/ast';
import { isExportedType, listedExports } from './exports-of.ts';
import { isProduction, nodes, resolved, sourceOf } from './checker.ts';
import { Prefixes } from './exemptions.ts';
import type { Scan } from './checker.ts';
import { isEmpty } from './lists.ts';
import { present } from './present.ts';

/** Modules that read the harness library's types without being production modules themselves. */
const CHECK_ROOTS = new Prefixes(['harness/checks/']);

/** An exported type and whether its doc comment carries `@public`. */
interface ExportedType {
  readonly path: string;
  readonly name: string;
  readonly isPublic: boolean;
}

/**
 * Whether `reader` counts as a reader of a type `declarer` exports.
 *
 * @param {string} reader - The module that names the type.
 * @param {string} declarer - The module that exports it.
 * @returns {boolean} Whether the naming counts as a read.
 */
function reads(reader: string, declarer: string): boolean {
  return reader !== declarer && (!isProduction(declarer) || isProduction(reader) || CHECK_ROOTS.starts(reader));
}

/**
 * Whether a node sits in an import or export declaration.
 *
 * @param {Node} node - The node.
 * @returns {boolean} Whether an enclosing node imports or exports.
 */
function inImportOrExport(node: Node): boolean {
  for (let current = node.parent; !isSourceFile(current); current = current.parent) {
    if (isImportDeclaration(current) || isExportDeclaration(current) || isExportAssignment(current)) {
      return true;
    }
  }
  return false;
}

/**
 * The exported types of the covered production modules.
 *
 * @param {Scan} scan - The open scan.
 * @returns {ReadonlyMap<number, ExportedType>} Each exported type, by symbol id.
 */
function exportedTypes(scan: Scan): ReadonlyMap<number, ExportedType> {
  const found = new Map<number, ExportedType>();
  for (const path of scan.paths) {
    const file = sourceOf(scan, path);
    const listed = listedExports(file);
    for (const statement of file.statements) {
      const symbol =
        (isTypeAliasDeclaration(statement) || isInterfaceDeclaration(statement)) && isExportedType(statement, listed)
          ? scan.checker.getSymbolAtLocation(statement.name)
          : undefined;
      if (symbol !== undefined && (isTypeAliasDeclaration(statement) || isInterfaceDeclaration(statement))) {
        const isPublic = scan.checker.getJsDocTagsOfSymbol(symbol).some((tag) => tag.name === 'public');
        found.set(symbol.id, { isPublic, name: statement.name.text, path });
      }
    }
  }
  return found;
}

/**
 * The names a module reads: its identifiers outside import and export declarations.
 *
 * @param {Scan} scan - The open scan.
 * @param {string} path - The module.
 * @returns {readonly Identifier[]} The identifiers.
 */
function namesIn(scan: Scan, path: string): readonly Identifier[] {
  return nodes(sourceOf(scan, path)).filter((node): node is Identifier => isIdentifier(node) && !inImportOrExport(node));
}

/** The symbols each read name resolves to, resolved once per symbol across the scan. */
class Targets {
  private readonly aliases = new Map<number, TsSymbol | undefined>();

  private readonly checker: Readonly<Checker>;

  /**
   * A resolver over one checker.
   *
   * @param {Readonly<Checker>} checker - The scan's checker.
   */
  public constructor(checker: Readonly<Checker>) {
    this.checker = checker;
  }

  /**
   * The symbol a name's symbol resolves to through its aliases.
   *
   * @param {TsSymbol} symbol - The name's symbol.
   * @returns {TsSymbol | undefined} The resolved symbol, or undefined.
   */
  public of(symbol: TsSymbol): TsSymbol | undefined {
    if (!this.aliases.has(symbol.id)) {
      this.aliases.set(symbol.id, resolved(this.checker, symbol));
    }
    return this.aliases.get(symbol.id);
  }
}

/**
 * For each symbol, the covered reader modules that name it.
 *
 * @param {Scan} scan - The open scan.
 * @returns {ReadonlyMap<number, ReadonlySet<string>>} The reader modules, by symbol id.
 */
function readers(scan: Scan): ReadonlyMap<number, ReadonlySet<string>> {
  const found = new Map<number, Set<string>>();
  const targets = new Targets(scan.checker);
  for (const path of scan.paths) {
    const names = namesIn(scan, path);
    const symbols = isEmpty(names) ? [] : scan.checker.getSymbolAtLocation(names);
    for (const target of symbols.flatMap((symbol) => (symbol === undefined ? [] : [targets.of(symbol)]))) {
      if (target !== undefined) {
        found.set(target.id, new Set([...(found.get(target.id) ?? []), path]));
      }
    }
  }
  return found;
}

/**
 * The exported types no other reader module names and that are not marked `@public`.
 *
 * @param {Scan} scan - The open scan.
 * @returns {readonly ExportedType[]} The unread types.
 */
function unread(scan: Scan): readonly ExportedType[] {
  const read = readers(scan);
  return [...exportedTypes(scan)]
    .filter(
      ([id, type]: readonly [number, ExportedType]) =>
        !type.isPublic &&
        ![...present(read.get(id), `the readers of ${type.name}, its own module among them`)].some((path) => reads(path, type.path)),
    )
    .map(([, type]: readonly [number, ExportedType]) => type);
}

export { unread };
