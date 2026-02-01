/**
 * Shared remark/unist utilities for linting tools.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { createHash } from 'node:crypto';

const parser = unified().use(remarkParse);

/** Parse markdown string → mdast tree */
export function parseMarkdown(content) {
  return parser.parse(content);
}

/** Walk AST nodes matching any of `types`, calling `callback(node)` */
export function visitNodes(tree, types, callback) {
  const typeSet = new Set(types);
  visit(tree, (node) => {
    if (typeSet.has(node.type)) callback(node);
  });
}

/** First 16 hex chars of SHA-256 */
export function contentHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
