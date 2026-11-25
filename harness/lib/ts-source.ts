/**
 * The harness's reader of TypeScript source: syntax trees and comments, through TypeScript 7's
 * `typescript/unstable/ast` and the parser of `typescript/unstable/sync`. Every scan that reads
 * TypeScript structure asks this module.
 *
 * TypeScript 7 parses in its native compiler, reached through one API session per process
 * (`ts-session.ts`). Text is handed to it through a virtual file system, so a planted module is
 * parsed exactly as a listed one, by extension: a `.tsx` path parses as JSX.
 */

import type { CommentRange, Expression, Identifier, ImportDeclaration, Node, SourceFile } from 'typescript/unstable/ast';
import { api, mount, nextName } from './ts-session.ts';
import { getLeadingCommentRanges, getTrailingCommentRanges } from 'typescript/unstable/ast/scanner';
import {
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isInterfaceDeclaration,
  isJsxExpression,
  isNamedImports,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isSourceFile,
  isStringLiteral,
  isTypeAliasDeclaration,
  isTypeNode,
} from 'typescript/unstable/ast/is';
import { present } from './present.ts';

/** A comment of a module: its text (delimiters included), its 1-based line and the code before it. */
interface Comment {
  readonly text: string;
  readonly line: number;
  readonly code: string;
}

const VIRTUAL_ROOT = '/harness-virtual';

/** The difference between TypeScript's 0-based lines and a reader's 1-based ones. */
const FIRST_LINE = 1;

/** The length of the brace that opens a JSX expression. */
const BRACE_LENGTH = 1;

/** The column a line starts at. */
const LINE_START = 0;

/** The opening of a line comment. */
const LINE_COMMENT = '//';

const BLOCK_OPENING = /^\/\*+/u;
const BLOCK_CLOSING = /\*+\/$/u;
const BLOCK_LINE_STAR = /^\s*\*?\s?/u;

/**
 * Parse one module's text under its path; the extension decides the language (`.tsx` is JSX).
 *
 * @param {string} path - The module's repository-relative path.
 * @param {string} text - Its text.
 * @returns {SourceFile} The parsed module.
 */
function parse(path: string, text: string): SourceFile {
  const fileName = `${VIRTUAL_ROOT}/${nextName()}/${path}`;
  const unmount = mount(new Map([[fileName, text]]));
  try {
    const snapshot = api().updateSnapshot({ openFiles: [fileName] });
    const file = snapshot.getDefaultProjectForFile(fileName)?.program.getSourceFile(fileName);
    api().updateSnapshot({ closeFiles: [fileName] });
    return present(file, `the source file TypeScript parsed from ${path}`);
  } finally {
    unmount();
  }
}

/**
 * Every node of a tree, depth first, the tree itself included.
 *
 * @param {Node} root - The tree.
 * @returns {Node[]} Its nodes.
 */
function nodes(root: Node): Node[] {
  const found: Node[] = [];
  const visit = (node: Node): void => {
    found.push(node);
    node.forEachChild(visit);
  };
  visit(root);
  return found;
}

/**
 * The comment ranges around one node: the trivia before and after it, and, for a JSX comment
 * (`{/* … *\/}`, an empty JSX expression no child node carries the trivia of), the trivia inside it.
 *
 * @param {string} text - The module's text.
 * @param {Node} node - The node.
 * @returns {readonly CommentRange[]} The ranges.
 */
function rangesAround(text: string, node: Node): readonly CommentRange[] {
  const around = [...(getLeadingCommentRanges(text, node.pos) ?? []), ...(getTrailingCommentRanges(text, node.end) ?? [])];
  if (!isJsxExpression(node) || node.expression !== undefined) {
    return around;
  }
  const inside = text.indexOf('{', node.pos) + BRACE_LENGTH;
  return [...around, ...(getLeadingCommentRanges(text, inside) ?? []), ...(getTrailingCommentRanges(text, inside) ?? [])];
}

/**
 * Every comment of a module, in order; comment-like text inside strings and templates is not one.
 *
 * @param {SourceFile} file - The module.
 * @returns {Comment[]} Its comments.
 */
function comments(file: SourceFile): Comment[] {
  const { text } = file;
  const lines = text.split('\n');
  const seen = new Map<number, CommentRange>();
  for (const node of [...nodes(file), file.endOfFileToken]) {
    for (const range of rangesAround(text, node)) {
      seen.set(range.pos, range);
    }
  }
  return [...seen.values()]
    .toSorted((left, right) => left.pos - right.pos)
    .map((range) => {
      const { line, character } = file.getLineAndCharacterOfPosition(range.pos);
      return {
        code: present(lines.at(line), `line ${String(line)}`)
          .slice(LINE_START, character)
          .trim(),
        line: line + FIRST_LINE,
        text: text.slice(range.pos, range.end),
      };
    });
}

/**
 * A comment's body without its delimiters and the leading stars of a block comment's lines.
 *
 * @param {string} comment - The comment, delimiters included.
 * @returns {string} Its body.
 */
function body(comment: string): string {
  if (comment.startsWith(LINE_COMMENT)) {
    return comment.slice(LINE_COMMENT.length).trim();
  }
  return comment
    .replace(BLOCK_OPENING, '')
    .replace(BLOCK_CLOSING, '')
    .split('\n')
    .map((line) => line.replace(BLOCK_LINE_STAR, ''))
    .join('\n')
    .trim();
}

/**
 * The names one import declaration binds, mapped to the names they import.
 *
 * @param {ImportDeclaration} statement - The import declaration.
 * @returns {readonly (readonly [string, string])[]} Each local name and the name it imports.
 */
function namedImports(statement: ImportDeclaration): readonly (readonly [string, string])[] {
  const bindings = statement.importClause?.namedBindings;
  if (bindings === undefined || !isNamedImports(bindings)) {
    return [];
  }
  return bindings.elements.flatMap((element) => {
    const imported = element.propertyName ?? element.name;
    return isIdentifier(imported) ? [[element.name.text, imported.text] as const] : [];
  });
}

/**
 * The local names a module imports from `module`, mapped to the names they import.
 *
 * @param {SourceFile} file - The module.
 * @param {string | ((specifier: string) => boolean)} module - A specifier, or a test of the specifier as the module writes it.
 * @returns {ReadonlyMap<string, string>} Each local name and the name it imports.
 */
function importsFrom(file: SourceFile, module: string | ((specifier: string) => boolean)): ReadonlyMap<string, string> {
  const named = typeof module === 'string' ? (specifier: string): boolean => specifier === module : module;
  return new Map(
    file.statements.flatMap((statement) =>
      isImportDeclaration(statement) && isStringLiteral(statement.moduleSpecifier) && named(statement.moduleSpecifier.text)
        ? namedImports(statement)
        : [],
    ),
  );
}

/**
 * The names of a property-access chain from its root, such as `test.describe.skip`.
 *
 * @param {Expression} node - The expression.
 * @returns {string[] | undefined} The names, or undefined when it is not a chain of names.
 */
function chain(node: Expression): string[] | undefined {
  if (isIdentifier(node)) {
    return [node.text];
  }
  if (isPropertyAccessExpression(node)) {
    const head = chain(node.expression);
    return head === undefined || !isIdentifier(node.name) ? undefined : [...head, node.name.text];
  }
  return undefined;
}

/**
 * Whether an identifier names a property (`a.path`, `{ path: 1 }`) rather than a binding.
 *
 * @param {Identifier} node - The identifier.
 * @returns {boolean} Whether it names a property.
 */
function isPropertyName(node: Identifier): boolean {
  const { parent } = node;
  return (isPropertyAccessExpression(parent) && parent.name === node) || (isPropertyAssignment(parent) && parent.name === node);
}

/**
 * Whether a node, or an ancestor of it below its source file, meets `boundary`.
 *
 * @param {Node} node - The node.
 * @param {(candidate: Node) => boolean} boundary - The kinds of node the walk stops at.
 * @returns {boolean} Whether the node sits within one.
 */
function within(node: Node, boundary: (candidate: Node) => boolean): boolean {
  for (let current = node; !isSourceFile(current); current = current.parent) {
    if (boundary(current)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a node holds no runtime value: it is or sits in a type, a type alias or interface
 * declaration, or an import or export declaration. A heritage clause's expression is a type node
 * (`ExpressionWithTypeArguments`), so a call in a class's `extends` reads as a type here, as it did in
 * each walk this one replaced. The one answer every scan of
 * runtime uses and words reads.
 *
 * @param {Node} node - The node.
 * @returns {boolean} Whether no runtime value can be in it.
 */
function holdsNoRuntimeValue(node: Node): boolean {
  return within(
    node,
    (candidate) =>
      isTypeNode(candidate) ||
      isImportDeclaration(candidate) ||
      isExportDeclaration(candidate) ||
      isImportEqualsDeclaration(candidate) ||
      isTypeAliasDeclaration(candidate) ||
      isInterfaceDeclaration(candidate),
  );
}

export { body, chain, comments, holdsNoRuntimeValue, importsFrom, isPropertyName, nodes, parse, within };
export { closeSession } from './ts-session.ts';
export type { Expression, Node, SourceFile } from 'typescript/unstable/ast';
