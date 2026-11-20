/**
 * The harness's reader of TypeScript source: syntax trees and comments, through the `typescript`
 * compiler API. Every scan that reads TypeScript structure asks this module.
 */

import ts from 'typescript';

/** Parse one module's text; `.tsx` paths parse as JSX. */
export function parse(path: string, text: string): ts.SourceFile {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
}

/** Every node of a tree, depth first, the tree itself included. */
export function nodes(root: ts.Node): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

/** A comment of a module: its text (delimiters included), its 1-based line and the code before it. */
export interface Comment {
  readonly text: string;
  readonly line: number;
  readonly code: string;
}

/** Every comment of a module, in order; comment-like text inside strings and templates is not one. */
export function comments(file: ts.SourceFile): Comment[] {
  const text = file.getFullText();
  const lines = text.split('\n');
  const seen = new Map<number, ts.CommentRange>();
  const collect = (ranges: readonly ts.CommentRange[] | undefined): void => {
    for (const range of ranges ?? []) {
      seen.set(range.pos, range);
    }
  };
  for (const node of [...nodes(file), file.endOfFileToken]) {
    collect(ts.getLeadingCommentRanges(text, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(text, node.getEnd()));
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
export function importsFrom(file: ts.SourceFile, module: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === module
    ) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          found.set(element.name.text, (element.propertyName ?? element.name).text);
        }
      }
    }
  }
  return found;
}

/** The names of a property-access chain from its root, such as `test.describe.skip`. */
export function chain(node: ts.Expression): string[] | undefined {
  if (ts.isIdentifier(node)) {
    return [node.text];
  }
  if (ts.isPropertyAccessExpression(node)) {
    const head = chain(node.expression);
    return head === undefined ? undefined : [...head, node.name.text];
  }
  return undefined;
}
