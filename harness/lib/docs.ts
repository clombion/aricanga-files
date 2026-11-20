/**
 * The one reader of the repository's prose: Markdown structure, and the comments of code.
 *
 * "Current text" is what describes the project as it is: the held Markdown files and those under
 * the doc roots of `scope.ts`, except the history files; the comments of every held TypeScript or
 * JavaScript file (read through TypeScript's own parser, so a string holding `//` is never a
 * comment); the comments of held stylesheets; and the full-line comments of held TOML and YAML.
 * History files record what happened and are left out.
 *
 * The Markdown reader knows fences, inline code spans, links, headings, pipe tables and the
 * generated blocks `harness/scripts/gen-docs.ts` writes. It does not read reference-style links,
 * HTML other than the block markers, or a table cell holding an escaped pipe.
 */

import ts from 'typescript';

import { Prefixes } from './exemptions.ts';
import { DOC_ROOTS, held } from './scope.ts';
import { textOf, tracked } from './source-files.ts';

/** The history files: they record what happened, so current-text checks leave them out. */
export const HISTORY = new Prefixes(['docs/roadmap/tasks/', 'CHANGELOG.md']);

/** The code files whose comments are current text, by suffix. */
const SCRIPT = new Prefixes(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const STYLE = new Prefixes(['.css']);
const CONFIG = new Prefixes(['.toml', '.yml', '.yaml']);

const FENCE = /^ {0,3}(```+|~~~+)(.*)$/;
const SPAN = /(`+)(.+?)\1/g;
const LINK = /(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BLOCK_START = /^<!-- generated: ([\w-]+) -->$/;
const BLOCK_END = /^<!-- end: ([\w-]+) -->$/;
const HTML_COMMENT = /<!--.*?-->/g;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/** One line of current text, with its code spans removed. */
export interface Prose {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

/** An inline code span of current text. */
export interface Span {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

/** A fenced code block: its info string and its lines. */
export interface Fence {
  readonly path: string;
  readonly line: number;
  readonly info: string;
  readonly lines: readonly string[];
}

/** An inline link of a Markdown file. */
export interface Link {
  readonly path: string;
  readonly line: number;
  readonly target: string;
}

/** A Markdown heading. */
export interface Heading {
  readonly line: number;
  readonly level: number;
  readonly text: string;
}

/** A generated block: the generator's name and the lines between its markers. */
export interface Block {
  readonly path: string;
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly body: string;
}

export class BlockError extends Error {
  override readonly name = 'BlockError';
}

/** Text with its inline code spans removed. */
export function withoutSpans(text: string): string {
  return text.replaceAll(SPAN, '');
}

/** The inline code spans of a line, trimmed. */
export function spansOf(text: string): readonly string[] {
  return [...text.matchAll(SPAN)].map((match) => (match[2] ?? '').trim());
}

/** The anchor GitHub gives a heading: lowercase, punctuation dropped, spaces as hyphens. */
export function anchor(heading: string): string {
  const text = heading
    .replaceAll(SPAN, (_whole, _ticks: string, inner: string) => inner)
    .trim()
    .toLowerCase();
  return text.replaceAll(/[^\p{L}\p{N}_\- ]/gu, '').replaceAll(' ', '-');
}

/** A parsed Markdown file. */
export class Doc {
  readonly path: string;
  readonly text: string;
  readonly lines: readonly string[];
  private readonly inFence: ReadonlySet<number>;

  constructor(path: string, text: string) {
    this.path = path;
    this.text = text;
    this.lines = text.split('\n');
    if (this.lines.at(-1) === '') {
      this.lines = this.lines.slice(0, -1);
    }
    this.inFence = this.fenceLines();
  }

  private fenceLines(): ReadonlySet<number> {
    const inside = new Set<number>();
    let opener: string | undefined;
    this.lines.forEach((line, index) => {
      const number = index + 1;
      const match = FENCE.exec(line);
      if (opener === undefined && match !== null) {
        opener = match[1];
        inside.add(number);
      } else if (opener !== undefined) {
        inside.add(number);
        if (match !== null && (match[1] ?? '').startsWith(opener) && (match[2] ?? '').trim() === '') {
          opener = undefined;
        }
      }
    });
    return inside;
  }

  private outside(): readonly (readonly [number, string])[] {
    return this.lines
      .map((line, index) => [index + 1, line] as const)
      .filter(([number]) => !this.inFence.has(number));
  }

  /** Every fenced code block. */
  fences(): readonly Fence[] {
    const found: Fence[] = [];
    let current: { line: number; info: string; lines: string[] } | undefined;
    this.lines.forEach((line, index) => {
      const number = index + 1;
      if (!this.inFence.has(number)) {
        return;
      }
      const match = FENCE.exec(line);
      if (current === undefined) {
        current = { line: number, info: (match?.[2] ?? '').trim(), lines: [] };
      } else if (match !== null && (match[2] ?? '').trim() === '') {
        found.push({ path: this.path, ...current });
        current = undefined;
      } else {
        current.lines.push(line);
      }
    });
    return found;
  }

  /** Every inline code span outside the fences. */
  spans(): readonly Span[] {
    return this.outside().flatMap(([line, text]) => spansOf(text).map((span) => ({ path: this.path, line, text: span })));
  }

  /** Every inline link outside the fences and code spans. */
  links(): readonly Link[] {
    return this.outside().flatMap(([line, text]) =>
      [...withoutSpans(text).matchAll(LINK)].map((match) => ({ path: this.path, line, target: match[2] ?? '' })),
    );
  }

  /** Every ATX heading outside the fences. */
  headings(): readonly Heading[] {
    return this.outside().flatMap(([line, text]) => {
      const match = HEADING.exec(text);
      return match === null ? [] : [{ line, level: (match[1] ?? '').length, text: match[2] ?? '' }];
    });
  }

  /** The anchors of the headings. */
  anchors(): ReadonlySet<string> {
    return new Set(this.headings().map((heading) => anchor(heading.text)));
  }

  /** Every line outside the fences, without its code spans and HTML comments. */
  prose(): readonly Prose[] {
    return this.outside()
      .filter(([, text]) => text.trim() !== '')
      .map(([line, text]) => ({ path: this.path, line, text: withoutSpans(text).replaceAll(HTML_COMMENT, '') }));
  }

  /** Every generated block, refusing a marker without its pair. */
  blocks(): readonly Block[] {
    const found: Block[] = [];
    let open: { name: string; line: number } | undefined;
    this.lines.forEach((raw, index) => {
      const number = index + 1;
      const line = raw.trim();
      const start = BLOCK_START.exec(line);
      const end = BLOCK_END.exec(line);
      if (start !== null && open === undefined) {
        open = { name: start[1] ?? '', line: number };
      } else if (end !== null && open !== undefined && end[1] === open.name) {
        const body = this.lines.slice(open.line, number - 1).join('\n');
        found.push({ path: this.path, name: open.name, start: open.line, end: number, body });
        open = undefined;
      } else if (start !== null || end !== null) {
        throw new BlockError(`${this.path}:${number}: unpaired generated-block marker ${JSON.stringify(line)}`);
      }
    });
    if (open !== undefined) {
      throw new BlockError(`${this.path}:${open.line}: generated block ${JSON.stringify(open.name)} has no end marker`);
    }
    return found;
  }

  /** Every pipe table outside the fences, as rows of cells, without the delimiter row. */
  tables(): readonly (readonly (readonly string[])[])[] {
    const tables: string[][][] = [];
    let current: string[][] = [];
    for (const [, line] of [...this.outside(), [0, ''] as const]) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|')) {
        const cells = trimmed
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-+:?$/.test(cell))) {
          current.push(cells);
        }
      } else if (current.length > 0) {
        tables.push(current);
        current = [];
      }
    }
    return tables;
  }
}

/** A listed Markdown file, parsed. */
export function markdown(path: string): Doc {
  return new Doc(path, textOf(path));
}

/** Whether a listed path is a Markdown file of current text. */
export function isCurrentMarkdown(path: string): boolean {
  return (
    path.endsWith('.md') && (held(path) || DOC_ROOTS.some((root) => path.startsWith(root))) && !HISTORY.starts(path)
  );
}

/** The listed Markdown files of current text. */
export function markdownPaths(): readonly string[] {
  return tracked().filter(isCurrentMarkdown);
}

/** The (line, text) of every comment line of TypeScript or JavaScript source, read by the parser. */
export function scriptComments(path: string, text: string): readonly (readonly [number, string])[] {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const ranges = new Map<number, ts.CommentRange>();
  const visit = (node: ts.Node): void => {
    for (const range of [
      ...(ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []),
      ...(ts.getTrailingCommentRanges(text, node.end) ?? []),
    ]) {
      ranges.set(range.pos, range);
    }
    node.forEachChild(visit);
  };
  visit(source);
  visit(source.endOfFileToken);
  return [...ranges.values()]
    .toSorted((a, b) => a.pos - b.pos)
    .flatMap((range) => commentLines(text, range.pos, text.slice(range.pos, range.end)));
}

function commentLines(text: string, pos: number, comment: string): readonly (readonly [number, string])[] {
  const first = text.slice(0, pos).split('\n').length;
  return comment
    .split('\n')
    .map((line, offset) => [first + offset, cleanComment(line)] as const)
    .filter(([, line]) => line !== '');
}

function cleanComment(line: string): string {
  return line
    .trim()
    .replace(/^\/\/+\s?/, '')
    .replace(/^\/\*+\s?/, '')
    .replace(/\*+\/$/, '')
    .replace(/^\*\s?/, '')
    .trim();
}

/** The (line, text) of every comment line of a stylesheet. */
export function styleComments(text: string): readonly (readonly [number, string])[] {
  return [...text.matchAll(CSS_COMMENT)].flatMap((match) => commentLines(text, match.index, match[0]));
}

/** The (line, text) of every full-line comment of a TOML or YAML file. */
export function configComments(text: string): readonly (readonly [number, string])[] {
  return text
    .split('\n')
    .map((line, index) => [index + 1, line.trim()] as const)
    .filter(([, line]) => line.startsWith('#'))
    .map(([number, line]) => [number, line.replace(/^#+\s?/, '').trim()] as const)
    .filter(([, line]) => line !== '');
}

/** The (line, text) of every comment line of a held code file. */
export function codeComments(path: string, text: string): readonly (readonly [number, string])[] {
  if (SCRIPT.ends(path)) {
    return scriptComments(path, text);
  }
  if (STYLE.ends(path)) {
    return styleComments(text);
  }
  return configComments(text);
}

/** The held code files whose comments are current text. */
export function codePaths(): readonly string[] {
  return tracked().filter((path) => held(path) && (SCRIPT.ends(path) || STYLE.ends(path) || CONFIG.ends(path)));
}

/** Every line of current text, with code spans removed. */
export function currentText(): readonly Prose[] {
  const found: Prose[] = markdownPaths().flatMap((path) => markdown(path).prose());
  for (const path of codePaths()) {
    for (const [line, text] of codeComments(path, textOf(path))) {
      found.push({ path, line, text: withoutSpans(text) });
    }
  }
  return found;
}

/** Every inline code span of current text. */
export function currentSpans(): readonly Span[] {
  const found: Span[] = markdownPaths().flatMap((path) => markdown(path).spans());
  for (const path of codePaths()) {
    for (const [line, text] of codeComments(path, textOf(path))) {
      found.push(...spansOf(text).map((span) => ({ path, line, text: span })));
    }
  }
  return found;
}
