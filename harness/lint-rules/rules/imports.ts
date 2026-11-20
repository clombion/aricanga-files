/** What the module-boundary rules share: visiting every place a module names another module. */

import { child, children, type Context, moduleSource, nameOf, type Node, type Visitor } from '../ast.ts';

/** A module a file names, with the names it imports from it (empty for a bare or dynamic import). */
export interface Imported {
  readonly source: string;
  readonly names: readonly string[];
  readonly node: Node;
}

function importedNames(node: Node): readonly string[] {
  return children(node, 'specifiers').flatMap((specifier) => {
    if (specifier.type === 'ImportSpecifier') {
      return [nameOf(child(specifier, 'imported')) ?? ''];
    }
    return [];
  });
}

/** A visitor that calls `seen` for every import, re-export and literal dynamic import of a file. */
export function onImports(seen: (imported: Imported) => void): Visitor {
  const visit = (node: Node): void => {
    const source = moduleSource(node);
    if (source !== undefined) {
      seen({ source, names: node.type === 'ImportDeclaration' ? importedNames(node) : [], node });
    }
  };
  return {
    ImportDeclaration: visit,
    ExportNamedDeclaration: visit,
    ExportAllDeclaration: visit,
    ImportExpression: visit,
  };
}

/** Report `message` on the import's node. */
export function refuse(context: Context, imported: Imported, message: string): void {
  context.report({ message, node: imported.node });
}
