/**
 * A parsed Markdown file: fences, inline code spans, links, headings, pipe tables and the generated
 * blocks `harness/scripts/gen-docs.ts` writes. It does not read reference-style links, HTML other
 * than the block markers, or a table cell holding an escaped pipe.
 */

import type { Block, Fence, Heading, Link, Numbered, Prose, Span } from './markdown-text.ts';
import {
  FIRST_LINE,
  anchor,
  blockMarkers,
  fenceLines,
  fenceMarker,
  headingOf,
  linkTargets,
  spansOf,
  withoutSpans,
} from './markdown-text.ts';
import { BlockError } from './block-error.ts';
import { Slot } from './lists.ts';
import { present } from './present.ts';

/** A generated block whose end marker is not read yet. */
interface OpenBlock {
  readonly name: string;
  readonly line: number;
}

/** A fenced block whose closing marker is not read yet. */
interface OpenFence {
  readonly info: string;
  readonly line: number;
  readonly lines: readonly string[];
}

const TRAILING_NEWLINE = /\n$/u;
const HTML_COMMENT = /<!--.*?-->/gu;

/** The line before a block's end marker, from the marker's number. */
const BEFORE = 1;

/** A parsed Markdown file. */
class Doc {
  public readonly path: string;

  public readonly text: string;

  public readonly lines: readonly string[];

  private readonly inFence: Readonly<ReadonlySet<number>>;

  /**
   * Parse a Markdown file.
   *
   * @param {string} path - Its repository-relative path.
   * @param {string} text - Its text.
   */
  public constructor(path: string, text: string) {
    this.path = path;
    this.text = text;
    this.lines = text === '' ? [] : text.replace(TRAILING_NEWLINE, '').split('\n');
    this.inFence = fenceLines(this.lines);
  }

  /**
   * Every fenced code block.
   *
   * @returns {readonly Fence[]} The blocks.
   */
  public fences(): readonly Fence[] {
    const open = new Slot<OpenFence>();
    return this.numbered()
      .filter(([candidate]: Numbered) => this.inFence.has(candidate))
      .flatMap(([number, line]: Numbered) => this.fenceAt(number, line, open));
  }

  /**
   * Every inline code span outside the fences.
   *
   * @returns {readonly Span[]} The spans.
   */
  public spans(): readonly Span[] {
    return this.outside().flatMap(([line, text]: Numbered) => spansOf(text).map((span) => ({ line, path: this.path, text: span })));
  }

  /**
   * Every inline link outside the fences and code spans.
   *
   * @returns {readonly Link[]} The links.
   */
  public links(): readonly Link[] {
    return this.outside().flatMap(([line, text]: Numbered) =>
      linkTargets(withoutSpans(text)).map((target) => ({ line, path: this.path, target })),
    );
  }

  /**
   * Every ATX heading outside the fences.
   *
   * @returns {readonly Heading[]} The headings.
   */
  public headings(): readonly Heading[] {
    return this.outside().flatMap((numbered: Numbered) => headingOf(numbered));
  }

  /**
   * The anchors of the headings.
   *
   * @returns {ReadonlySet<string>} The anchors.
   */
  public anchors(): ReadonlySet<string> {
    return new Set(this.headings().map((heading) => anchor(heading.text)));
  }

  /**
   * Every line outside the fences, without its code spans and HTML comments.
   *
   * @returns {readonly Prose[]} The lines.
   */
  public prose(): readonly Prose[] {
    return this.outside()
      .filter(([, text]: Numbered) => text.trim() !== '')
      .map(([line, text]: Numbered) => ({ line, path: this.path, text: withoutSpans(text).replaceAll(HTML_COMMENT, '') }));
  }

  /**
   * Every generated block, refusing a marker without its pair.
   *
   * @returns {readonly Block[]} The blocks.
   */
  public blocks(): readonly Block[] {
    const open = new Slot<OpenBlock>();
    const found = this.numbered().flatMap(([number, raw]: Numbered) => this.blockAt(number, raw.trim(), open));
    const unclosed = open.peek();
    if (unclosed !== undefined) {
      throw new BlockError(`${this.path}:${unclosed.line}: generated block ${JSON.stringify(unclosed.name)} has no end marker`);
    }
    return found;
  }

  /**
   * Read one line's block marker, opening or closing a block.
   *
   * @param {number} number - The line's number.
   * @param {string} line - The line, trimmed.
   * @param {Readonly<Slot<OpenBlock>>} open - The block opened and not yet closed, if any; this line may open or close it.
   * @returns {readonly Block[]} The block the line closes, or nothing.
   */
  private blockAt(number: number, line: string, open: Readonly<Slot<OpenBlock>>): readonly Block[] {
    const { end, start } = blockMarkers(line);
    const current = open.peek();
    if (start !== undefined && current === undefined) {
      open.put({ line: number, name: start });
      return [];
    }
    if (end !== undefined && current?.name === end) {
      return this.closedBlock(open, number);
    }
    if (start !== undefined || end !== undefined) {
      throw new BlockError(`${this.path}:${number}: unpaired generated-block marker ${JSON.stringify(line)}`);
    }
    return [];
  }

  /**
   * Close the open block at its end marker.
   *
   * @param {Readonly<Slot<OpenBlock>>} open - The open block, emptied here.
   * @param {number} number - The end marker's line.
   * @returns {readonly Block[]} The closed block.
   */
  private closedBlock(open: Readonly<Slot<OpenBlock>>, number: number): readonly Block[] {
    const opened = present(open.take(), `the block the end marker at line ${String(number)} closes`);
    const body = this.lines.slice(opened.line, number - BEFORE).join('\n');
    return [{ body, end: number, name: opened.name, path: this.path, start: opened.line }];
  }

  /**
   * Read one fenced line, opening, extending or closing a fence.
   *
   * @param {number} number - The line's number.
   * @param {string} line - The line.
   * @param {Readonly<Slot<OpenFence>>} open - The fence opened and not yet closed, if any; this line may open, extend or close it.
   * @returns {readonly Fence[]} The fence the line closes, or nothing.
   */
  private fenceAt(number: number, line: string, open: Readonly<Slot<OpenFence>>): readonly Fence[] {
    const marker = fenceMarker(line);
    const current = open.peek();
    if (current === undefined) {
      open.put({ info: present(marker, `the fence marker at line ${String(number)}`).info, line: number, lines: [] });
      return [];
    }
    if (marker?.info === '') {
      open.take();
      return [{ path: this.path, ...current }];
    }
    open.put({ ...current, lines: [...current.lines, line] });
    return [];
  }

  /**
   * Every line, numbered from one.
   *
   * @returns {readonly Numbered[]} The lines.
   */
  private numbered(): readonly Numbered[] {
    return this.lines.map((line, index) => [index + FIRST_LINE, line] as const);
  }

  /**
   * The lines outside the fences.
   *
   * @returns {readonly Numbered[]} The lines.
   */
  private outside(): readonly Numbered[] {
    return this.numbered().filter(([number]: Numbered) => !this.inFence.has(number));
  }
}

export { Doc };
