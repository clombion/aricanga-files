/** What the module-boundary rules share: visiting every place a module names another module. */

import type { Context, Node, Visitor } from '#lint-rules/ast.ts';
import { child, children, moduleSource, nameOf } from '#lint-rules/ast.ts';

/** A module a file names, with the names it imports from it (empty for a bare or dynamic import). */
interface Imported {
  readonly source: string;
  readonly names: readonly string[];
  readonly node: Node;
}

/**
 * The names an import declaration imports by name (not its default or namespace import).
 * @param {Node} node - An `ImportDeclaration`.
 * @returns {readonly string[]} The imported names.
 */
function importedNames(node: Node): readonly string[] {
  return children(node, 'specifiers').flatMap((specifier) =>
    specifier.type === 'ImportSpecifier' ? [nameOf(child(specifier, 'imported')) ?? ''] : [],
  );
}

/**
 * A visitor that calls `seen` for every import, re-export and literal dynamic import of a file.
 * @param {(imported: Imported) => void} seen - What to do with each module the file names.
 * @returns {Visitor} The visitor.
 */
function onImports(seen: (imported: Imported) => void): Visitor {
  const visit = (node: Node): void => {
    const source = moduleSource(node);
    if (source !== undefined) {
      seen({ names: node.type === 'ImportDeclaration' ? importedNames(node) : [], node, source });
    }
  };
  return {
    ExportAllDeclaration: visit,
    ExportNamedDeclaration: visit,
    ImportDeclaration: visit,
    ImportExpression: visit,
  };
}

/**
 * Report `message` on the import's node.
 * @param {Context} context - The rule's context.
 * @param {Imported} imported - The refused import.
 * @param {string} message - What the rule reports.
 */
function refuse(context: Context, imported: Imported, message: string): void {
  context.report({ message, node: imported.node });
}

export { onImports, refuse };
