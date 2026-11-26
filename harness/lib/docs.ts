/**
 * The one reader of the repository's prose: Markdown structure, and the comments of code.
 *
 * "Current text" is what describes the project as it is: the held Markdown files and those under
 * the roadmap (`ROADMAP`), except the history files; the comments of every held TypeScript or
 * JavaScript file (read through `ts-source.ts`, so a string holding `//` is never a comment); the
 * comments of held stylesheets; and the full-line comments of held TOML and YAML. History files
 * record what happened and are left out.
 *
 * Markdown is parsed by `markdown-doc.ts` on the grammar of `markdown-text.ts`.
 */

import type { Prose, Span } from './markdown-text.ts';
import { TYPESCRIPT, textOf, textsOf } from './source-files.ts';
import { comments, parse } from './ts-source.ts';
import { heldFiles, population } from './scope.ts';
import { spansOf, withoutSpans } from './markdown-text.ts';
import { Doc } from './markdown-doc.ts';
import type { Population } from './scope.ts';
import { Prefixes } from './exemptions.ts';

/** A comment line: its number and its text. */
type CommentLine = readonly [number, string];

/** The history files: they record what happened, so current-text checks leave them out. */
const HISTORY: Prefixes = new Prefixes(['docs/roadmap/tasks/', 'CHANGELOG.md']);

/** The roadmap: current text the population does not hold. */
const ROADMAP = 'docs/roadmap/';

/** The code files whose comments are current text, by suffix. */
const SCRIPT = new Prefixes([...TYPESCRIPT, '.js', '.mjs', '.cjs']);
const STYLE = new Prefixes(['.css']);
const CONFIG = new Prefixes(['.toml', '.yml', '.yaml']);

const CSS_COMMENT = /\/\*[\s\S]*?\*\//gu;
const LINE_COMMENT_OPENER = /^\/\/+\s?/u;
const BLOCK_OPENER = /^\/\*+\s?/u;
const BLOCK_CLOSER = /\*+\/$/u;
const BLOCK_STAR = /^\*\s?/u;
const HASH_OPENER = /^#+\s?/u;

/** The number of a file's first line. */
const FIRST_LINE = 1;

/** The index of a text's first character. */
const TEXT_START = 0;

/**
 * A listed Markdown file, parsed.
 *
 * @param {string} path - The file's repository-relative path.
 * @returns {Promise<Doc>} The parsed file.
 */
async function markdown(path: string): Promise<Doc> {
  const text = await textOf(path);
  return new Doc(path, text);
}

/**
 * Whether a listed path is a Markdown file of current text.
 *
 * @param {Population} held - The population.
 * @param {string} path - The path.
 * @returns {boolean} Whether it is current Markdown.
 */
function isCurrentMarkdown(held: Population, path: string): boolean {
  return path.endsWith('.md') && (held.holds(path) || path.startsWith(ROADMAP)) && !HISTORY.starts(path);
}

/**
 * The listed Markdown files of current text.
 *
 * @returns {Promise<readonly string[]>} The files.
 */
async function markdownPaths(): Promise<readonly string[]> {
  const held = await population();
  return held.listing.filter((path) => isCurrentMarkdown(held, path));
}

/**
 * Every listed Markdown file of current text, parsed.
 *
 * @returns {Promise<readonly Doc[]>} The parsed files.
 */
async function markdownDocs(): Promise<readonly Doc[]> {
  const paths = await markdownPaths();
  const texts = await textsOf(paths);
  return texts.map(([path, body]: readonly [string, string]) => new Doc(path, body));
}

/**
 * A comment line without its delimiters.
 *
 * @param {string} line - The line.
 * @returns {string} Its text.
 */
function cleanComment(line: string): string {
  return line.trim().replace(LINE_COMMENT_OPENER, '').replace(BLOCK_OPENER, '').replace(BLOCK_CLOSER, '').replace(BLOCK_STAR, '').trim();
}

/**
 * The non-empty lines of a comment, numbered.
 *
 * @param {number} first - The number of the comment's first line.
 * @param {string} comment - The comment.
 * @returns {readonly CommentLine[]} Its lines.
 */
function numbered(first: number, comment: string): readonly CommentLine[] {
  return comment
    .split('\n')
    .map((line, offset) => [first + offset, cleanComment(line)] as const)
    .filter(([, line]: CommentLine) => line !== '');
}

/**
 * The comment lines of TypeScript or JavaScript source, read by the parser.
 *
 * @param {string} path - The file's path.
 * @param {string} text - Its text.
 * @returns {readonly CommentLine[]} Its comment lines.
 */
function scriptComments(path: string, text: string): readonly CommentLine[] {
  return comments(parse(path, text)).flatMap((comment) => numbered(comment.line, comment.text));
}

/**
 * The comment lines of a stylesheet.
 *
 * @param {string} text - The stylesheet.
 * @returns {readonly CommentLine[]} Its comment lines.
 */
function styleComments(text: string): readonly CommentLine[] {
  const found: CommentLine[] = [];
  for (const match of text.matchAll(CSS_COMMENT)) {
    const [comment] = match;
    found.push(...numbered(text.slice(TEXT_START, match.index).split('\n').length, comment));
  }
  return found;
}

/**
 * The full-line comments of a TOML or YAML file.
 *
 * @param {string} text - The file.
 * @returns {readonly CommentLine[]} Its comment lines.
 */
function configComments(text: string): readonly CommentLine[] {
  return text
    .split('\n')
    .map((line, index) => [index + FIRST_LINE, line.trim()] as const)
    .filter(([, line]: CommentLine) => line.startsWith('#'))
    .map(([number, line]: CommentLine) => [number, line.replace(HASH_OPENER, '').trim()] as const)
    .filter(([, line]: CommentLine) => line !== '');
}

/**
 * The comment lines of a held code file.
 *
 * @param {string} path - The file's path.
 * @param {string} text - Its text.
 * @returns {readonly CommentLine[]} Its comment lines.
 */
function codeComments(path: string, text: string): readonly CommentLine[] {
  if (SCRIPT.ends(path)) {
    return scriptComments(path, text);
  }
  if (STYLE.ends(path)) {
    return styleComments(text);
  }
  return configComments(text);
}

/**
 * The held code files whose comments are current text.
 *
 * @returns {Promise<readonly (readonly [string, string])[]>} Each file with its text.
 */
async function codeTexts(): Promise<readonly (readonly [string, string])[]> {
  const held = await heldFiles();
  const texts = await textsOf(held.filter((path) => SCRIPT.ends(path) || STYLE.ends(path) || CONFIG.ends(path)));
  return texts;
}

/**
 * Every line of current text, with code spans removed.
 *
 * @returns {Promise<readonly Prose[]>} The lines.
 */
async function currentText(): Promise<readonly Prose[]> {
  const [docs, code] = await Promise.all([markdownDocs(), codeTexts()]);
  return [
    ...docs.flatMap((doc) => doc.prose()),
    ...code.flatMap(([path, body]: readonly [string, string]) =>
      codeComments(path, body).map(([line, text]: CommentLine) => ({ line, path, text: withoutSpans(text) })),
    ),
  ];
}

/**
 * Every inline code span of current text.
 *
 * @returns {Promise<readonly Span[]>} The spans.
 */
async function currentSpans(): Promise<readonly Span[]> {
  const [docs, code] = await Promise.all([markdownDocs(), codeTexts()]);
  return [
    ...docs.flatMap((doc) => doc.spans()),
    ...code.flatMap(([path, body]: readonly [string, string]) =>
      codeComments(path, body).flatMap(([line, text]: CommentLine) => spansOf(text).map((span) => ({ line, path, text: span }))),
    ),
  ];
}

export { BlockError } from './block-error.ts';
export { Doc } from './markdown-doc.ts';
export type { Block, Link, Prose, Span } from './markdown-text.ts';
export { currentSpans, currentText, markdown, markdownDocs, markdownPaths };
