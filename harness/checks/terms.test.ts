/**
 * No current text uses a retired term or a refused pattern of `docs/terms.toml`.
 *
 * A retired term is matched as a whole word, in any case, in prose outside code spans: a span
 * quoting the old name is a quotation. A refused pattern is matched in prose and in code spans; a
 * pattern refused in code is matched in the comments of code only. Each retired term names the
 * term that replaced it.
 */

import { Exemptions, Prefixes, site } from '#lib/exemptions.ts';
import type { Prose, Span } from '#lib/docs.ts';
import { currentSpans, currentText } from '#lib/docs.ts';
import { describe, expect, test } from 'vitest';
import { object, stringRecord } from '#lib/config.ts';
import { parse as parseToml } from '@iarna/toml';
import { textOf } from '#lib/source-files.ts';

const HARNESS_ID = 'terms';

/** The current text that is Markdown; every other line of current text is a comment of code. */
const MARKDOWN = new Prefixes(['.md']);

/** Uses of a retired term whose code cannot change yet, keyed by `site(path, term)`. */
const EXEMPT = new Exemptions({});

/** The parsed terms file. */
interface Terms {
  readonly retired: ReadonlyMap<string, string>;
  readonly refused: ReadonlyMap<string, string>;
  readonly refusedInCode: ReadonlyMap<string, string>;
}

/**
 * Read a parsed terms file, refusing a retired term without its replacement.
 *
 * @param {string} text - The text.
 * @returns {Terms} Read a parsed terms file, refusing a retired term without its replacement.
 */
function termsOf(text: string): Terms {
  const data = object(parseToml(text), 'terms');
  const retired = new Map(Object.entries(stringRecord(data['retired'] ?? {}, 'retired')));
  const blank = [...retired]
    .filter(([, replacement]: readonly [string, string]) => replacement.trim() === '')
    .map(([term]: readonly [string, string]) => term);
  if (blank.some(Boolean)) {
    throw new TypeError(`retired terms without a replacement: ${JSON.stringify(blank)}`);
  }
  return {
    refused: new Map(Object.entries(stringRecord(data['refused'] ?? {}, 'refused'))),
    refusedInCode: new Map(Object.entries(stringRecord(data['refused-in-code'] ?? {}, 'refused-in-code'))),
    retired,
  };
}

/**
 * A term as a literal regular-expression source.
 *
 * @param {string} term - The term.
 * @returns {string} A term as a literal regular-expression source.
 */
function escaped(term: string): string {
  return term.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/** A use of current text the terms file refuses. */
interface Use {
  readonly path: string;
  readonly line: number;
  /** The retired term or the text the refused pattern matched. */
  readonly term: string;
  /** The replacement, or where the refused text belongs. */
  readonly why: string;
}

/**
 * Every use of a retired term in current prose.
 *
 * @param {Terms} terms - The terms.
 * @param {readonly Prose[]} prose - The prose.
 * @returns {Use[]} Each use, with the term's replacement.
 */
function retiredUses(terms: Terms, prose: readonly Prose[]): Use[] {
  const found: Use[] = [];
  for (const [term, replacement] of terms.retired) {
    const pattern = new RegExp(String.raw`\b${escaped(term)}\b`, 'iu');
    found.push(
      ...prose
        .filter((line) => pattern.test(line.text))
        .map((line) => ({ line: line.line, path: line.path, term, why: `use ${replacement}` })),
    );
  }
  return found;
}

/**
 * Every match of a refused pattern: in prose and code spans, and, for a pattern refused in code only, outside Markdown.
 *
 * @param {Terms} terms - The terms.
 * @param {readonly Prose[]} prose - The prose.
 * @param {readonly Span[]} spans - The code spans.
 * @returns {Use[]} Each match, with why the pattern is refused.
 */
function refusedUses(terms: Terms, prose: readonly Prose[], spans: readonly Span[]): Use[] {
  const refusals = [
    ...[...terms.refused].map(([pattern, why]: readonly [string, string]) => [pattern, why, [...prose, ...spans]] as const),
    ...[...terms.refusedInCode].map(
      ([pattern, why]: readonly [string, string]) =>
        [pattern, why, [...prose, ...spans].filter((line) => !MARKDOWN.ends(line.path))] as const,
    ),
  ];
  const found: Use[] = [];
  for (const [pattern, why, lines] of refusals) {
    const regex = new RegExp(pattern, 'gu');
    for (const line of lines) {
      for (const [term] of line.text.matchAll(regex)) {
        found.push({ line: line.line, path: line.path, term, why });
      }
    }
  }
  return found;
}

/**
 * Every use of current text that the terms file refuses.
 *
 * @param {Terms} terms - The terms.
 * @param {readonly Prose[]} prose - The prose.
 * @param {readonly Span[]} spans - The spans.
 * @returns {Use[]} Every use of current text that the terms file refuses.
 */
function uses(terms: Terms, prose: readonly Prose[], spans: readonly Span[]): Use[] {
  return [...retiredUses(terms, prose), ...refusedUses(terms, prose, spans)];
}

/**
 * A use's exemption key.
 *
 * @param {Use} use - A refused use.
 * @returns {string} Its `site(path, term)` key.
 */
function key(use: Use): string {
  return site(use.path, use.term);
}

describe('the repository', () => {
  test('no current text uses a refused term', async () => {
    expect.hasAssertions();
    const [text, lines, spans] = await Promise.all([textOf('docs/terms.toml'), currentText(), currentSpans()]);
    const found = uses(termsOf(text), lines, spans);
    expect(EXEMPT.unexemptedBy(found, key)).toStrictEqual([]);
  });
});

const PLANTED_TERMS = `[retired]
sentinel = "marker"
[refused]
"TASK-[0-9]+" = "the tracker"
[refused-in-code]
"ticket-[0-9]+" = "the tracker"
`;

describe('the terms check', () => {
  test('sees a planted retired term, refused pattern and code-only pattern, and lets the near misses through', () => {
    expect.hasAssertions();
    const terms = termsOf(PLANTED_TERMS);
    const prose = [
      { line: 1, path: 'docs/planted.md', text: 'A Sentinel value closes TASK-12.' },
      { line: 2, path: 'docs/planted.md', text: 'sentinels and ticket-4 in a doc' },
      { line: 3, path: 'src/planted.ts', text: 'closes ticket-9' },
    ];
    const spans = [
      { line: 4, path: 'docs/planted.md', text: 'TASK-7' },
      { line: 5, path: 'docs/planted.md', text: 'sentinel' },
    ];
    expect(uses(terms, prose, spans)).toStrictEqual([
      { line: 1, path: 'docs/planted.md', term: 'sentinel', why: 'use marker' },
      { line: 1, path: 'docs/planted.md', term: 'TASK-12', why: 'the tracker' },
      { line: 4, path: 'docs/planted.md', term: 'TASK-7', why: 'the tracker' },
      { line: 3, path: 'src/planted.ts', term: 'ticket-9', why: 'the tracker' },
    ]);
  });

  test('refuses a retired term without its replacement', () => {
    expect.hasAssertions();
    expect(() => termsOf('[retired]\nsentinel = " "\n')).toThrow(/without a replacement/u);
  });

  test('reads the repository terms file', async () => {
    expect.hasAssertions();
    const terms = termsOf(await textOf('docs/terms.toml'));
    expect([...terms.retired, ...terms.refused, ...terms.refusedInCode]).not.toStrictEqual([]);
  });
});

export { HARNESS_ID, termsOf, uses };
