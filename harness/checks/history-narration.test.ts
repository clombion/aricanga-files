/**
 * Current text describes the project as it is: no comment or doc narrates how it got there.
 *
 * The phrases refused: `previously`, `originally`, `formerly`, `no longer` (but not
 * `no longer than`), `for now`, `until … lands`, `we discovered`, `the first time we`, `this PR`,
 * and an ISO date inside a comment of code. History files (`harness/lib/docs.ts` names them) are
 * left out, and a phrase in a code span is a quotation.
 */

import { Exemptions, Prefixes, site } from '#lib/exemptions.ts';
import { describe, expect, test } from 'vitest';
import type { Prose } from '#lib/docs.ts';
import { currentText } from '#lib/docs.ts';

const HARNESS_ID = 'history-narration';

const NARRATION =
  /\b(?:previously|originally|formerly|no longer(?! than)|for now|until\b.{1,40}\blands?|we discovered|the first time we|(?:before )?this PR)\b/giu;
const ISO_DATE = /\b20\d\d-\d\d-\d\d\b/gu;
/** The current text that is Markdown; a date there is a measurement, not narration. */
const MARKDOWN = new Prefixes(['.md']);

/** Prose that uses a refused phrase in its domain sense, keyed by `site(path, the phrase)`. */
const EXEMPT = Exemptions.grouped({});

/**
 * Every `site(path, phrase)` that narrates history, sorted and once each.
 *
 * @param {readonly Prose[]} lines - The lines.
 * @returns {string[]} Every `site(path, phrase)` that narrates history, sorted and once each.
 */
function narration(lines: readonly Prose[]): string[] {
  const found = new Set<string>();
  for (const line of lines) {
    const dates = MARKDOWN.ends(line.path) ? [] : [...line.text.matchAll(ISO_DATE)];
    for (const [phrase] of [...line.text.matchAll(NARRATION), ...dates]) {
      found.add(site(line.path, phrase));
    }
  }
  return [...found].toSorted();
}

describe('the repository', () => {
  test('no current text narrates history', async () => {
    expect.hasAssertions();
    const found = narration(await currentText());
    expect(EXEMPT.unexempted(found)).toStrictEqual([]);
  });
});

describe('the narration scan', () => {
  test.each([
    ['Logs previously lived in /var/log.', 'previously'],
    ['The bus was originally a singleton.', 'originally'],
    ['Formerly a class, it is a function.', 'Formerly'],
    ['This flag is no longer read.', 'no longer'],
    ['Keep the stub for now.', 'for now'],
    ['Skip it until the parser lands.', 'until the parser lands'],
    ['We discovered the cache was stale.', 'We discovered'],
    ['The first time we ran it, it hung.', 'The first time we'],
    ['Before this PR the gate wrote files.', 'Before this PR'],
  ])('sees the planted phrase in %j', (text, phrase) => {
    expect.hasAssertions();
    expect(narration([{ line: 1, path: 'docs/planted.md', text }])).toStrictEqual([site('docs/planted.md', phrase)]);
  });

  test('sees a date in a comment of code only', () => {
    expect.hasAssertions();
    expect(narration([{ line: 1, path: 'src/planted.ts', text: 'fixed on 2026-04-25' }])).toStrictEqual([
      site('src/planted.ts', '2026-04-25'),
    ]);
    expect(narration([{ line: 1, path: 'docs/planted.md', text: 'Measured on 2026-11-08.' }])).toStrictEqual([]);
  });

  test.each([
    'A name no longer than 64 characters.',
    'Show the previous row.',
    'Wait until the lock is free.',
    'Format it for nowhere in particular.',
    'The original order is kept.',
  ])('lets the near miss %j through', (text) => {
    expect.hasAssertions();
    expect(narration([{ line: 1, path: 'docs/planted.md', text }])).toStrictEqual([]);
  });
});

export { HARNESS_ID, narration };
