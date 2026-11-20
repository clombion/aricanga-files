/**
 * The harness's reader of TypeScript source: syntax trees and comments, through TypeScript 7's
 * `typescript/unstable/ast` and the parser of `typescript/unstable/sync`. Every scan that reads
 * TypeScript structure asks this module.
 *
 * TypeScript 7 parses in its native compiler, reached through one API session per process. Text is
 * handed to it through a virtual file system, so a planted module is parsed exactly as a listed one,
 * by extension: a `.tsx` path parses as JSX.
 */

import {
  type CallExpression,
  type CommentRange,
  type Expression,
  type Node,
  type SourceFile,
} from 'typescript/unstable/ast';
import {
  isArrowFunction,
  isCallExpression,
  isFunctionExpression,
  isIdentifier,
  isImportDeclaration,
  isJsxExpression,
  isNamedImports,
  isPropertyAccessExpression,
  isStringLiteral,
} from 'typescript/unstable/ast/is';
import { getLeadingCommentRanges, getTrailingCommentRanges } from 'typescript/unstable/ast/scanner';
import { API } from 'typescript/unstable/sync';

import { REPO_ROOT } from './paths.ts';

export type { CallExpression, Expression, Node, SourceFile };

export class ParseError extends Error {
  override readonly name = 'ParseError';
}

const VIRTUAL_ROOT = '/harness-virtual';
const virtual = new Map<string, string>();
let session: API | undefined;
let parsed = 0;

/**
 * Serve `files` ({absolute path: text}) through the session's virtual file system until the returned
 * function is called. A mounted path need not exist on disk; a mounted real path reads as its text.
 */
export function mount(files: ReadonlyMap<string, string>): () => void {
  for (const [name, text] of files) {
    virtual.set(name, text);
  }
  return () => {
    for (const name of files.keys()) {
      virtual.delete(name);
    }
  };
}

/** The process's one TypeScript API session; type-aware scans open their projects on it. */
export function api(): API {
  if (session === undefined) {
    const started = new API({
      cwd: REPO_ROOT,
      fs: {
        readFile: (fileName) => virtual.get(fileName),
        fileExists: (fileName) => (virtual.has(fileName) ? true : undefined),
      },
    });
    process.once('exit', () => {
      started.close();
    });
    session = started;
  }
  return session;
}

/** Parse one module's text under its path; the extension decides the language (`.tsx` is JSX). */
export function parse(path: string, text: string): SourceFile {
  parsed += 1;
  const fileName = `${VIRTUAL_ROOT}/${parsed}/${path}`;
  virtual.set(fileName, text);
  try {
    const snapshot = api().updateSnapshot({ openFiles: [fileName] });
    const file = snapshot.getDefaultProjectForFile(fileName)?.program.getSourceFile(fileName);
    api().updateSnapshot({ closeFiles: [fileName] });
    if (file === undefined) {
      throw new ParseError(`TypeScript returned no source file for ${path}`);
    }
    return file;
  } finally {
    virtual.delete(fileName);
  }
}

/** Every node of a tree, depth first, the tree itself included. */
export function nodes(root: Node): Node[] {
  const found: Node[] = [];
  const visit = (node: Node): undefined => {
    found.push(node);
    node.forEachChild(visit);
    return undefined;
  };
  visit(root);
  return found;
}

/** A comment of a module: its text (delimiters included), its 1-based line and the code before it. */
interface Comment {
  readonly text: string;
  readonly line: number;
  readonly code: string;
}

/** Every comment of a module, in order; comment-like text inside strings and templates is not one. */
export function comments(file: SourceFile): Comment[] {
  const text = file.text;
  const lines = text.split('\n');
  const seen = new Map<number, CommentRange>();
  const collect = (ranges: readonly CommentRange[] | undefined): void => {
    for (const range of ranges ?? []) {
      seen.set(range.pos, range);
    }
  };
  for (const node of [...nodes(file), file.endOfFileToken]) {
    collect(getLeadingCommentRanges(text, node.pos));
    collect(getTrailingCommentRanges(text, node.end));
    // A JSX comment, `{/* … */}`, is an empty JSX expression: no child node carries its trivia.
    if (isJsxExpression(node) && node.expression === undefined) {
      const inside = text.indexOf('{', node.pos) + 1;
      collect(getLeadingCommentRanges(text, inside));
      collect(getTrailingCommentRanges(text, inside));
    }
  }
  return [...seen.values()]
    .toSorted((a, b) => a.pos - b.pos)
    .map((range) => {
      const { line, character } = file.getLineAndCharacterOfPosition(range.pos);
      return {
        text: text.slice(range.pos, range.end),
        line: line + 1,
        code: (lines[line] ?? '').slice(0, character).trim(),
      };
    });
}

/** A comment's body without its delimiters and the leading stars of a block comment's lines. */
export function body(comment: string): string {
  if (comment.startsWith('//')) {
    return comment.slice(2).trim();
  }
  return comment
    .replace(/^\/\*+/, '')
    .replace(/\*+\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*?\s?/, ''))
    .join('\n')
    .trim();
}

/** The local names a module imports from `module`, mapped to the names they import. */
export function importsFrom(file: SourceFile, module: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const statement of file.statements) {
    if (
      isImportDeclaration(statement) &&
      isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === module
    ) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings !== undefined && isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const imported = element.propertyName ?? element.name;
          if (isIdentifier(imported)) {
            found.set(element.name.text, imported.text);
          }
        }
      }
    }
  }
  return found;
}

/** The names of a property-access chain from its root, such as `test.describe.skip`. */
export function chain(node: Expression): string[] | undefined {
  if (isIdentifier(node)) {
    return [node.text];
  }
  if (isPropertyAccessExpression(node)) {
    const head = chain(node.expression);
    return head === undefined || !isIdentifier(node.name) ? undefined : [...head, node.name.text];
  }
  return undefined;
}

/** The root name of a callee, looking through curried calls such as `test.skipIf(x)(...)`. */
export function calleeRoot(expression: Expression): string | undefined {
  return isCallExpression(expression) ? calleeRoot(expression.expression) : chain(expression)?.[0];
}

/** Whether a node is a function literal (an arrow or a function expression). */
export function isFunctionLiteral(node: Node): boolean {
  return isArrowFunction(node) || isFunctionExpression(node);
}
