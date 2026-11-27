/**
 * The modules a module imports, as the scan's checker resolves them: every string-literal-like node
 * of the module (a string literal or a template without substitutions) the checker resolves to a
 * module that answers it — a source file, or an ambient module declaration (`declare module` in a
 * script file) — that is not the platform's (`isPlatformDeclaration`). An augmentation (`declare
 * module` in a module file) answers nothing: it adds to a module another declaration answers, so it is
 * dropped (the user's decision D8). So every form is one case — an import, an `export … from`, a
 * type-only import, `import()` of a literal or a plain template, a type position's `import('x').T` and
 * `typeof import('x')`, `import x = require('x')` — and a plain string, an object key or an element
 * access names none. A computed `import()` specifier resolves to no module and names none. Its reader
 * is `contract-respellings.ts`, which asks which members a module reads; the whole chain reads its own
 * project's file list instead (`production-imports.ts`).
 */

import type { Node, SourceFile } from 'typescript/unstable/ast';
import { SyntaxKind, isStringLiteral } from 'typescript/unstable/ast';
import type { Scan } from './checker.ts';
import { isPlatformDeclaration } from './checker.ts';
import { nodes } from './ts-source.ts';
import { relative } from './paths.ts';

/**
 * Whether a declaration answers a module specifier: a source file, or a `declare module` in a script
 * file; an augmentation (a `declare module` in a module file) does not.
 *
 * @param {Scan} scan - The open scan.
 * @param {Readonly<{ kind: SyntaxKind; path: string }>} declaration - The declaration, by its kind and file.
 * @returns {boolean} Whether it answers the specifier.
 */
function answers(scan: Scan, declaration: Readonly<{ kind: SyntaxKind; path: string }>): boolean {
  if (declaration.kind === SyntaxKind.SourceFile) {
    return true;
  }
  return (
    declaration.kind === SyntaxKind.ModuleDeclaration && scan.program.getSourceFile(declaration.path)?.externalModuleIndicator === undefined
  );
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
 * The repository-relative files a module's specifiers resolve to, the platform's and augmentations left out.
 *
 * @param {Scan} scan - The open scan.
 * @param {SourceFile} file - The module.
 * @returns {readonly string[]} The files, in the order the module names them, each once.
 */
function importedModules(scan: Scan, file: SourceFile): readonly string[] {
  const found = nodes(file).flatMap((node) => {
    const declarations = namesText(node) ? (scan.checker.getSymbolAtLocation(node)?.declarations ?? []) : [];
    return declarations.flatMap((declaration) =>
      answers(scan, declaration) && !isPlatformDeclaration(declaration.path) ? [relative(declaration.path)] : [],
    );
  });
  return [...new Set(found)];
}

export { importedModules };
