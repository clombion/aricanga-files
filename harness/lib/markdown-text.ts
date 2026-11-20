/** The line-level grammar of the Markdown the docs checks read: fences, code spans, links, headings, table rows and block markers. */

/** One line of current text, with its code spans removed. */
interface Prose {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

/** An inline code span of current text. */
interface Span {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

/** A fenced code block: its info string and its lines. */
interface Fence {
  readonly path: string;
  readonly line: number;
  readonly info: string;
  readonly lines: readonly string[];
}

/** An inline link of a Markdown file. */
interface Link {
  readonly path: string;
  readonly line: number;
  readonly target: string;
}

/** A Markdown heading. */
interface Heading {
  readonly line: number;
  readonly level: number;
  readonly text: string;
}

/** A generated block: the generator's name and the lines between its markers. */
interface Block {
  readonly path: string;
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly body: string;
}

/** A numbered line of a doc. */
type Numbered = readonly [number, string];

/** A fence marker line: its backticks or tildes, and its info string. */
interface FenceMarker {
  readonly marker: string;
  readonly info: string;
}

const FENCE = /^ {0,3}(?<marker>```+|~~~+)(?<info>.*)$/u;
const SPAN = /(?<ticks>`+)(?<inner>.+?)\k<ticks>/gu;
const LINK = /(?<!!)\[[^\]]*\]\((?<target>[^)\s]+)(?:\s+"[^"]*")?\)/gu;
const HEADING = /^(?<hashes>#{1,6})\s+(?<text>.*?)\s*#*\s*$/u;
const BLOCK_START = /^<!-- generated: (?<name>[\w-]+) -->$/u;
const BLOCK_END = /^<!-- end: (?<name>[\w-]+) -->$/u;
const NOT_ANCHOR = /[^\p{L}\p{N}_\- ]/gu;
const OUTER_PIPES = /^\||\|$/gu;
const DELIMITER_CELL = /^:?-+:?$/u;

/** The number of a doc's first line. */
const FIRST_LINE = 1;

/**
 * Text with its inline code spans removed.
 *
 * @param {string} text - The text.
 * @returns {string} The text without spans.
 */
function withoutSpans(text: string): string {
  return text.replaceAll(SPAN, '');
}

/**
 * The inline code spans of a line, trimmed.
 *
 * @param {string} text - The line.
 * @returns {readonly string[]} Its spans' text.
 */
function spansOf(text: string): readonly string[] {
  const spans: string[] = [];
  for (const match of text.matchAll(SPAN)) {
    spans.push((match.groups?.['inner'] ?? '').trim());
  }
  return spans;
}

/**
 * The link targets of a line.
 *
 * @param {string} text - The line, without its code spans.
 * @returns {readonly string[]} The targets.
 */
function linkTargets(text: string): readonly string[] {
  const targets: string[] = [];
  for (const match of text.matchAll(LINK)) {
    targets.push(match.groups?.['target'] ?? '');
  }
  return targets;
}

/**
 * A line's ATX heading.
 *
 * @param {Numbered} numbered - The line and its number.
 * @returns {readonly Heading[]} Its heading, or nothing.
 */
function headingOf(numbered: Numbered): readonly Heading[] {
  const [line, text] = numbered;
  const groups = HEADING.exec(text)?.groups;
  return groups === undefined ? [] : [{ level: (groups['hashes'] ?? '').length, line, text: groups['text'] ?? '' }];
}

/**
 * The anchor GitHub gives a heading: lowercase, punctuation dropped, spaces as hyphens.
 *
 * @param {string} heading - The heading's text.
 * @returns {string} Its anchor.
 */
function anchor(heading: string): string {
  const text = heading.replaceAll(SPAN, '$<inner>').trim().toLowerCase();
  return text.replaceAll(NOT_ANCHOR, '').replaceAll(' ', '-');
}

/**
 * A line's fence marker.
 *
 * @param {string} line - The line.
 * @returns {FenceMarker | undefined} Its marker and info string, or undefined when it is no fence line.
 */
function fenceMarker(line: string): FenceMarker | undefined {
  const groups = FENCE.exec(line)?.groups;
  return groups === undefined ? undefined : { info: (groups['info'] ?? '').trim(), marker: groups['marker'] ?? '' };
}

/**
 * The fence open after a line: a line opens a fence, or closes the open one with a bare marker at
 * least as long.
 *
 * @param {string} opener - The open fence's marker, or `''` outside a fence.
 * @param {FenceMarker | undefined} found - The line's fence marker.
 * @returns {string} The fence open after the line, or `''`.
 */
function openerAfter(opener: string, found: FenceMarker | undefined): string {
  if (opener === '') {
    return found?.marker ?? '';
  }
  return found !== undefined && found.marker.startsWith(opener) && found.info === '' ? '' : opener;
}

/**
 * The lines inside a fence, the fence markers included.
 *
 * @param {readonly string[]} lines - The doc's lines.
 * @returns {ReadonlySet<number>} The numbers of the lines inside a fence.
 */
function fenceLines(lines: readonly string[]): ReadonlySet<number> {
  const inside = new Set<number>();
  let opener = '';
  for (const [index, line] of lines.entries()) {
    const found = fenceMarker(line);
    if (opener !== '' || found !== undefined) {
      inside.add(index + FIRST_LINE);
    }
    opener = openerAfter(opener, found);
  }
  return inside;
}

/**
 * The cells of a pipe-table row, or nothing for its delimiter row.
 *
 * @param {string} row - The row, trimmed.
 * @returns {readonly string[] | undefined} Its cells, trimmed, or undefined for the delimiter row.
 */
function cellsOf(row: string): readonly string[] | undefined {
  const cells = row
    .replaceAll(OUTER_PIPES, '')
    .split('|')
    .map((cell) => cell.trim());
  return cells.every((cell) => DELIMITER_CELL.test(cell)) ? undefined : cells;
}

/**
 * The generated-block markers of a line.
 *
 * @param {string} line - The line, trimmed.
 * @returns {Readonly<{ start: string | undefined; end: string | undefined }>} The block a marker opens, and the block one closes.
 */
function blockMarkers(line: string): Readonly<{ start: string | undefined; end: string | undefined }> {
  return { end: BLOCK_END.exec(line)?.groups?.['name'], start: BLOCK_START.exec(line)?.groups?.['name'] };
}

export { anchor, blockMarkers, cellsOf, fenceLines, fenceMarker, FIRST_LINE, headingOf, linkTargets, spansOf, withoutSpans };
export type { Block, Fence, Heading, Link, Numbered, Prose, Span };
