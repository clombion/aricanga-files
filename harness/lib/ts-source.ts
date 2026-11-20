/**
 * The harness's reader of TypeScript source: syntax trees and comments, through TypeScript 7's
 * `typescript/unstable/ast` and the parser of `typescript/unstable/sync`. Every scan that reads
 * TypeScript structure asks this module.
 *
 * TypeScript 7 parses in its native compiler, reached through one API session per process
 * (`ts-session.ts`). Text is handed to it through a virtual file system, so a planted module is
 * parsed exactly as a listed one, by extension: a `.tsx` path parses as JSX.
 */

import type { CommentRange, Expression, ImportDeclaration, Node, SourceFile } from 'typescript/unstable/ast';
import { api, mount, nextName } from './ts-session.ts';
import { getLeadingCommentRanges, getTrailingCommentRanges } from 'typescript/unstable/ast/scanner';
import {
  isIdentifier,
  isImportDeclaration,
  isJsxExpression,
  isNamedImports,
  isPropertyAccessExpression,
  isStringLiteral,
} from 'typescript/unstable/ast/is';

/** A module TypeScript could not parse. */
class ParseError extends Error {
  public override readonly name = 'ParseError';
}

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
    if (file === undefined) {
      throw new ParseError(`TypeScript returned no source file for ${path}`);
    }
    return file;
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
        code: (lines[line] ?? '').slice(LINE_START, character).trim(),
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

export { closeSession } from './ts-session.ts';
export type { Expression, Node, SourceFile } from 'typescript/unstable/ast';
export { body, chain, comments, importsFrom, nodes, parse };
