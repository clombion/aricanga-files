/**
 * The census of the `suppressions` check: each suppression comment of a module, refused or counted
 * under `site(path, tool:rule)`.
 */

import { Accepted, site } from '#lib/exemptions.ts';
import { body, comments, parse } from '#lib/ts-source.ts';
import { TYPESCRIPT } from '#lib/source-files.ts';

/** Which suppressing tool checks which file suffix, as `tool:suffix`. */
const CHECKS = new Accepted([
  ...['oxlint', 'typescript', 'coverage'].flatMap((tool) => [...TYPESCRIPT].map((kind) => `${tool}:${kind}`)),
  'stylelint:.css',
]);

const RULES = String.raw`[@\w./-]+(?:\s*,\s*[@\w./-]+)*`;
const DISABLE = /^(?<tool>oxlint|eslint|stylelint)-disable(?:-next-line|-line)?\b(?<rest>.*)$/su;
const NAMED_DISABLE = new RegExp(String.raw`^\s+(?<rules>${RULES})\s+--\s+\S`, 'u');
const ENABLE = /^(?:oxlint|eslint|stylelint)-enable\b/u;
const BIOME = /^biome-ignore(?:-all|-start|-end)?\b/u;
const EXPECT_ERROR = /^@ts-expect-error\b(?<rest>.*)$/su;
const REASONED = /^\s+--\s+\S/u;
const REFUSED_TS = /^(?<directive>@ts-(?:ignore|nocheck))\b/u;
const COVERAGE = /^(?:v8|c8|istanbul)\s+ignore\b/u;
const SUFFIX = /\.[a-z]+$/u;
/** A stylesheet's quoted strings and comments, an unclosed comment running to the end. */
const CSS_TOKEN = /(?<quoted>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(?<comment>\/\*[\s\S]*?(?:\*\/|$))/gu;

/** The number of the first line of a text. */
const FIRST_LINE = 1;

/**
 * The number of lines of a text.
 *
 * @param {string} text - Any text.
 * @returns {number} Its line count.
 */
function lineCount(text: string): number {
  return text.split('\n').length;
}

/** A suppression comment the census refuses. */
interface Problem {
  readonly path: string;
  readonly line: number;
  readonly problem: string;
}

/** What the census finds in one module: the refused comments and the counted sites. */
interface Census {
  readonly problems: readonly Problem[];
  readonly sites: readonly string[];
}

/** A comment and the line it starts on. */
interface Comment {
  readonly text: string;
  readonly line: number;
}

/** What one directive is: refused with a problem, counted under a tool's rules, or neither. */
type Verdict = { readonly problem: string } | { readonly tool: string; readonly rules: readonly string[] } | undefined;

/**
 * A path's file suffix.
 *
 * @param {string} path - A file's path.
 * @returns {string} Its suffix, with the dot, or `''`.
 */
function suffix(path: string): string {
  const [found = ''] = SUFFIX.exec(path) ?? [];
  return found;
}

/**
 * The comments of a stylesheet: every comment outside a quoted string.
 *
 * @param {string} text - The stylesheet.
 * @returns {readonly Comment[]} Its comments.
 */
function cssComments(text: string): readonly Comment[] {
  const found: Comment[] = [];
  for (const match of text.matchAll(CSS_TOKEN)) {
    const comment = match.groups?.['comment'];
    if (comment !== undefined) {
      found.push({ line: lineCount(text) - lineCount(text.slice(match.index)) + FIRST_LINE, text: comment });
    }
  }
  return found;
}

/**
 * The comments of a module or a stylesheet.
 *
 * @param {string} path - The file's path.
 * @param {string} text - The file's text.
 * @returns {readonly Comment[]} Its comments.
 */
function commentsOf(path: string, text: string): readonly Comment[] {
  return path.endsWith('.css') ? cssComments(text) : comments(parse(path, text));
}

/**
 * What a disable directive is.
 *
 * @param {Readonly<Record<string, string>>} groups - The groups of its `DISABLE` match.
 * @returns {Verdict} The directive's verdict.
 */
function disableVerdict(groups: Readonly<Record<string, string>>): Verdict {
  const tool = groups['tool'] ?? '';
  if (tool === 'eslint') {
    return { problem: 'eslint-disable is not honoured: use oxlint-disable' };
  }
  const rules = NAMED_DISABLE.exec(groups['rest'] ?? '')?.groups?.['rules'];
  if (rules === undefined) {
    return { problem: `a ${tool}-disable names its rules and ends with -- <reason>` };
  }
  return { rules: rules.split(',').map((rule) => rule.trim()), tool };
}

/** A `biome-ignore` left behind suppresses nothing: Biome is no tool of the project. */
const STRAY_BIOME: Verdict = { problem: 'a biome-ignore suppresses nothing: Biome is not one of the tools that check this repository' };

/**
 * What a `@ts-expect-error`, refused `@ts-` or coverage directive is.
 *
 * @param {string} directive - The comment's body.
 * @returns {Verdict} The directive's verdict.
 */
function typeOrCoverageVerdict(directive: string): Verdict {
  const expectError = EXPECT_ERROR.exec(directive)?.groups?.['rest'];
  if (expectError !== undefined) {
    return REASONED.test(expectError)
      ? { rules: ['expect-error'], tool: 'typescript' }
      : { problem: 'a @ts-expect-error ends with -- <reason>' };
  }
  const refused = REFUSED_TS.exec(directive)?.groups?.['directive'];
  if (refused !== undefined) {
    return { problem: `${refused} is refused: fix the type, or expect the error with its reason` };
  }
  return COVERAGE.test(directive) ? { rules: ['ignore'], tool: 'coverage' } : undefined;
}

/**
 * What one comment's directive is.
 *
 * @param {string} directive - The comment's body.
 * @returns {Verdict} The directive's verdict.
 */
function verdictOf(directive: string): Verdict {
  const disable = DISABLE.exec(directive)?.groups;
  if (disable !== undefined) {
    return disableVerdict(disable);
  }
  if (ENABLE.test(directive)) {
    return undefined;
  }
  return BIOME.test(directive) ? STRAY_BIOME : typeOrCoverageVerdict(directive);
}

/**
 * The census of one module: each suppression is refused or counted under `(path, tool:rule)`.
 *
 * @param {string} path - The module's path.
 * @param {string} text - The module's text.
 * @returns {Census} Its refused comments and counted sites.
 */
function census(path: string, text: string): Census {
  const problems: Problem[] = [];
  const sites: string[] = [];
  for (const comment of commentsOf(path, text)) {
    const verdict = verdictOf(body(comment.text));
    if (verdict !== undefined && 'problem' in verdict) {
      problems.push({ line: comment.line, path, problem: verdict.problem });
    } else if (verdict !== undefined && CHECKS.has(`${verdict.tool}:${suffix(path)}`)) {
      sites.push(...verdict.rules.map((rule) => site(path, `${verdict.tool}:${rule}`)));
    } else if (verdict !== undefined) {
      problems.push({ line: comment.line, path, problem: `${verdict.tool} does not check ${suffix(path)} files` });
    }
  }
  return { problems, sites };
}

/**
 * Whether some tool the census reads checks a file: its suffix is one of `CHECKS`' suffixes.
 *
 * @param {string} path - The file's path.
 * @returns {boolean} Whether the census reads it.
 */
function isCensused(path: string): boolean {
  return [...CHECKS].some((check) => check.endsWith(`:${suffix(path)}`));
}

export type { Census };
export { census, isCensused };
