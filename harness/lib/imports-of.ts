/**
 * The modules a module imports, as the scan's checker resolves them: every string-literal-like node
 * of the module (a string literal or a template without substitutions) the checker resolves to a
 * module, a source file or a module declaration, outside `node_modules`. So every form is one case —
 * an import, an `export … from`, a type-only import, `import()` of a literal or a plain template,
 * a type position's `import('x').T` and `typeof import('x')`, `import x = require('x')` — and a plain
 * string, an object key or an element access names none. A computed `import()` specifier resolves to
 * no module and names none. Every reader of "what a module imports" asks it.
 */

import type { Node, SourceFile } from 'typescript/unstable/ast';
import { SyntaxKind, isStringLiteral } from 'typescript/unstable/ast';
import type { Scan } from './checker.ts';
import { nodes } from './ts-source.ts';
import { relative } from './paths.ts';

/**
 * Whether a declaration is a module: a source file, or an ambient `declare module`.
 *
 * @param {Readonly<{ kind: SyntaxKind }>} declaration - The declaration, by its kind.
 * @returns {boolean} Whether it is a module.
 */
function isModule(declaration: Readonly<{ kind: SyntaxKind }>): boolean {
  return declaration.kind === SyntaxKind.SourceFile || declaration.kind === SyntaxKind.ModuleDeclaration;
}

/**
 * Whether a node is a string literal or a template literal without substitutions: a node that may name a module.
 *
 * @param {Node} node - The node.
 * @returns {boolean} Whether it may name a module.
 */
function namesText(node: Node): boolean {
  return isStringLiteral(node) || node.kind === SyntaxKind.NoSubstitutionTemplateLiteral;
}

/**
 * The repository-relative files a module's specifiers resolve to, outside `node_modules`.
 *
 * @param {Scan} scan - The open scan.
 * @param {SourceFile} file - The module.
 * @returns {readonly string[]} The files, in the order the module names them, each once.
 */
function importedModules(scan: Scan, file: SourceFile): readonly string[] {
  const found = nodes(file).flatMap((node) => {
    const declarations = namesText(node) ? (scan.checker.getSymbolAtLocation(node)?.declarations ?? []) : [];
    return declarations.flatMap((declaration) =>
      isModule(declaration) && !declaration.path.includes('/node_modules/') ? [relative(declaration.path)] : [],
    );
  });
  return [...new Set(found)];
}

export { importedModules };
