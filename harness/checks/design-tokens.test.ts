/** The `harness/design-tokens` rule, run in-process: raw values outside the tokens are reported, a token file's own tokens and a rule switched off are not. */

import { describe, expect, test } from 'vitest';
import plugin, { messages, rawTokenValues, ruleName } from '#lib/design-tokens.ts';
import stylelint from 'stylelint';

/**
 * The warnings the rule reports over a sheet.
 *
 * @param {string} code - The sheet.
 * @param {string} file - Where the sheet is.
 * @param {unknown} primary - The rule's primary option.
 * @returns {Promise<readonly string[]>} Each warning's text.
 */
async function warnings(code: string, file: string, primary: unknown): Promise<readonly string[]> {
  const result = await stylelint.lint({ code, codeFilename: file, config: { plugins: [plugin], rules: { [ruleName]: primary } } });
  const texts: string[] = [];
  for (const sheet of result.results) {
    for (const warning of sheet.warnings) {
      texts.push(warning.text);
    }
  }
  return texts;
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
    await expect(warnings('.a {\n  --tint: #fff;\n  padding: 1rem;\n}\n', 'plant/part.css', true)).resolves.toStrictEqual([
      messages.raw('colour', '#fff'),
      messages.raw('size', '1rem'),
    ]);
  });

  test('lets the token file define its tokens', async () => {
    expect.hasAssertions();
    await expect(warnings(':root {\n  --gap: 1rem;\n}\n', 'plant/tokens.css', true)).resolves.toStrictEqual([]);
  });

  test('reports nothing unless switched on', async () => {
    expect.hasAssertions();
    await expect(warnings('.a {\n  padding: 1rem;\n}\n', 'plant/part.css', 'planted')).resolves.toStrictEqual([]);
  });

  test('reads a sheet with no file name as no token file', async () => {
    expect.hasAssertions();
    const result = await stylelint.lint({
      code: ':root {\n  --gap: 1rem;\n}\n',
      config: { plugins: [plugin], rules: { [ruleName]: true } },
    });
    expect(result.errored).toBe(true);
  });
});
