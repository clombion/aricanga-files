/** The `harness/design-tokens` rule, through the repository's stylelint: raw values outside the tokens are reported, the token file's own tokens are not. */

import { describe, expect, test } from 'vitest';
import { messages, rawTokenValues, ruleName } from '#lib/design-tokens.ts';
import { lintSheet } from '#lib/stylesheets.ts';

/** The first line of a planted sheet. */
const FIRST_LINE = 1;

/**
 * The rule's warnings over a planted sheet.
 *
 * @param {string} path - Where the sheet is.
 * @param {string} text - The sheet.
 * @returns {Promise<readonly string[]>} Each warning's text.
 */
async function warnings(path: string, text: string): Promise<readonly string[]> {
  const found = await lintSheet({ line: FIRST_LINE, path, text });
  return found.filter((finding) => finding.rule === ruleName).map((finding) => finding.text);
}

describe('the raw values a token holds', () => {
  test('are each size, duration, colour, easing and non-zero z-index, and a zero size is none', () => {
    expect.hasAssertions();
    expect(rawTokenValues('1rem 0px 200ms #fff rgb(0 0 0) ease')).toStrictEqual([
      ['size', '1rem'],
      ['duration', '200ms'],
      ['colour', '#fff'],
      ['colour', 'rgb('],
      ['easing', 'ease'],
    ]);
    expect(rawTokenValues('3')).toStrictEqual([['z-index', '3']]);
  });
});

describe('the rule', () => {
  test('reports a raw size in a declaration and a raw colour in a custom property outside the token file', async () => {
    expect.hasAssertions();
    await expect(warnings('plant/part.css', '.a {\n  --tint: #fff;\n  padding: 1rem;\n}\n')).resolves.toStrictEqual([
      messages.raw('colour', '#fff'),
      messages.raw('size', '1rem'),
    ]);
  });

  test('lets the token file define its tokens, and holds its other declarations to them', async () => {
    expect.hasAssertions();
    await expect(warnings('plant/tokens.css', ':root {\n  --gap: 1rem;\n}\n\n.a {\n  padding: 2rem;\n}\n')).resolves.toStrictEqual([
      messages.raw('size', '2rem'),
    ]);
  });
});
