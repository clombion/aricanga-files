/**
 * The whole chain's readings of a production module and of its project's files
 * (`production-imports.ts`): the forms it cannot read (V3, the user's answer on card A of audit
 * js261126), refused where they stand — an `import.meta` member outside `ADMITTED_META`, an `import()`
 * whose specifier is not a literal (card D-P5-1: a wrapped, asserted, folded or conditional literal
 * included, which Vite bundles, and any computed one), a specifier with a query, a specifier only a
 * pattern declaration answers (F1b2-R1-V1) — and the held file a program's file stands for under the
 * declaration rule. Loading that is not `import` syntax stays unread: `createRequire(…)(path)`, a
 * `Worker` by path, an installed loader handed a path (none in the repository).
 */

import {
  SyntaxKind,
  isCallExpression,
  isExportDeclaration,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportTypeNode,
  isLiteralTypeNode,
  isMetaProperty,
  isNoSubstitutionTemplateLiteral,
  isPropertyAccessExpression,
  isStringLiteral,
} from 'typescript/unstable/ast';
import { Accepted } from '#lint-rules/exemptions.ts';
import type { Checker } from 'typescript/unstable/sync';
import type { Node } from 'typescript/unstable/ast';
import { declaredFile } from './declaration-paths.ts';

/** Where an `import()`'s specifier sits among its arguments, and how many it is: the first, one. */
const FIRST = 0;
const SPECIFIER_COUNT = 1;

/** The `import.meta` members a production module may read: inert values no bundler turns into a file. */
const ADMITTED_META: Accepted<string> = new Accepted<string>(['dirname', 'env', 'filename']);

/**
 * Whether a node is a module specifier: the string of an import, an export, an `import()`, an
 * `import x = require()` or an import type.
 *
 * @param {Node} node - The node.
 * @returns {boolean} Whether it names a module.
 */
function isSpecifier(node: Node): boolean {
  const { parent } = node;
  if (!(isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node))) {
    return false;
  }
  return (
    isImportDeclaration(parent) ||
    isExportDeclaration(parent) ||
    isExternalModuleReference(parent) ||
    (isLiteralTypeNode(parent) && isImportTypeNode(parent.parent)) ||
    (isCallExpression(parent) && parent.expression.kind === SyntaxKind.ImportKeyword)
  );
}

/**
 * The `import.meta` member a node reads, if it is one outside the admitted set.
 *
 * @param {Node} node - A node of a production module.
 * @returns {string | undefined} The refused form, or none.
 */
function metaForm(node: Node): string | undefined {
  if (!isMetaProperty(node) || node.keywordToken !== SyntaxKind.ImportKeyword) {
    return undefined;
  }
  const { parent } = node;
  if (!isPropertyAccessExpression(parent) || !isIdentifier(parent.name)) {
    return 'import.meta read whole';
  }
  return ADMITTED_META.has(parent.name.text) ? undefined : `import.meta.${parent.name.text}`;
}

/**
 * The specifier form a node writes that the scan cannot read, if it is one: a query, or a specifier
 * only a pattern declaration answers in the production project.
 *
 * @param {Node} node - A node of a production module.
 * @param {Readonly<Checker>} checker - The production project's checker.
 * @returns {string | undefined} The refused form, or none.
 */
function specifierForm(node: Node, checker: Readonly<Checker>): string | undefined {
  if (!isSpecifier(node) || !(isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node))) {
    return undefined;
  }
  if (node.text.includes('?')) {
    return `a specifier with a query: ${node.text}`;
  }
  const symbol = checker.getSymbolAtLocation(node);
  return symbol?.name.includes('*') === true ? `a specifier only a pattern declaration answers: ${node.text}` : undefined;
}

/**
 * The `import()` a node writes whose specifier is not a literal (a string or a template with no
 * substitution), if it is one, by the text of its argument.
 *
 * @param {Node} node - A node of a production module.
 * @returns {string | undefined} The refused form, or none.
 */
function computedImport(node: Node): string | undefined {
  if (!isCallExpression(node) || node.expression.kind !== SyntaxKind.ImportKeyword) {
    return undefined;
  }
  const specifier = node.arguments.slice(FIRST, SPECIFIER_COUNT);
  if (specifier.some((argument) => isStringLiteral(argument) || isNoSubstitutionTemplateLiteral(argument))) {
    return undefined;
  }
  const file = node.getSourceFile();
  return `an import() of a specifier that is not a literal: ${specifier.map((argument) => file.text.slice(argument.getStart(file), argument.end)).join('')}`;
}

/**
 * The form one node of a production module writes that the scan cannot read (V3), if it is one: an
 * `import.meta` member outside the admitted set, an `import()` whose specifier is not a literal, a
 * specifier with a query, a specifier only a pattern declaration answers.
 *
 * @param {Node} node - A node of the module, in the production project.
 * @param {Readonly<Checker>} checker - The production project's checker.
 * @returns {string | undefined} The refused form, or none.
 */
function unreadForm(node: Node, checker: Readonly<Checker>): string | undefined {
  return computedImport(node) ?? metaForm(node) ?? specifierForm(node, checker);
}

/**
 * The repository-relative file a program's file stands for: a declaration the session declared by
 * rule (one the population does not list, beside a file it lists) stands for the file it declares.
 *
 * @param {ReadonlySet<string>} listed - The population's listed files.
 * @param {string} file - A program's file, repository-relative.
 * @returns {string} The file it stands for.
 */
function standsFor(listed: ReadonlySet<string>, file: string): string {
  const declared = declaredFile(file);
  return declared !== undefined && !listed.has(file) && listed.has(declared) ? declared : file;
}

export { ADMITTED_META, standsFor, unreadForm };
