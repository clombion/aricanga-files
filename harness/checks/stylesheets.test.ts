/**
 * Every stylesheet passes stylelint, reads raw values only through design tokens, and every class and custom property it names is used.
 *
 * A sheet is a held `.css` file or a `css` template literal in a held module, so a stylesheet
 * written inside a component is held like a file. Each sheet is linted with `.stylelintrc.json`:
 * stylelint's standard rules, logical properties and units, features the supported browsers have,
 * and `harness/design-tokens` (a raw size, colour, duration, easing or z-index only in a
 * `tokens.css` definition). Across sheets: every custom property defined is read and every one read
 * is defined, every class defined is named by a module or page, and no selector is written twice in
 * one media context.
 */

import { describe, expect, test } from 'vitest';

import { customPropertyProblems, duplicateRules, unusedClasses } from '../lib/sheet-scans.ts';
import { lintSheet, readers, sheets, sheetsOf, withoutSheets } from '../lib/stylesheets.ts';
import type { Sheet } from '../lib/stylesheets.ts';
import { rawSizes, rawTokenValues } from '../lib/design-tokens.ts';
import { json, object } from '../lib/config.ts';
import { textOf } from '../lib/source-files.ts';

export const HARNESS_ID = 'stylesheets';


/** The rules `.stylelintrc.json` turns on itself (the standard config's own are its plants' concern). */
function configuredRules(): readonly string[] {
  const rules = object(object(json(textOf('.stylelintrc.json')), '.stylelintrc.json')['rules'], 'rules');
  return Object.entries(rules)
    .filter(([, value]) => value !== null && value !== false)
    .map(([rule]) => rule);
}

async function lintText(path: string, text: string): Promise<readonly string[]> {
  const findings = await Promise.all(sheetsOf(path, text).map(lintSheet));
  return findings.flat().map((finding) => finding.rule);
}

describe('the repository', () => {
  test('every sheet passes the lint', async () => {
    expect((await Promise.all(sheets().map(lintSheet))).flat()).toEqual([]);
  });

  test('every custom property is defined and read, every class is used, no selector repeats', async () => {
    const all = sheets();
    const modules = readers();
    expect([
      ...(await customPropertyProblems(all, modules)),
      ...(await unusedClasses(all, modules)),
      ...(await Promise.all(all.map(duplicateRules))).flat(),
    ]).toEqual([]);
  });
});

const RM = '\n\n@media (prefers-reduced-motion: reduce) {\n  .a {\n    transition: none;\n  }\n}\n';

/** One plant per rule `.stylelintrc.json` turns on: a sheet the rule must fail, and a near miss every rule passes. */
const PLANTS: readonly (readonly [string, string, string])[] = [
  ['no-descending-specificity', 'p .a {\n  color: var(--x);\n}\n\n.a {\n  color: var(--y);\n}\n', '.a {\n  color: var(--y);\n}\n\np .a {\n  color: var(--x);\n}\n'],
  ['selector-max-specificity', '.a .b .c {\n  color: var(--x);\n}\n', '.a .b {\n  color: var(--x);\n}\n'],
  ['selector-max-compound-selectors', 'p span em strong {\n  color: var(--x);\n}\n', 'p span em {\n  color: var(--x);\n}\n'],
  ['max-nesting-depth', 'p {\n  & span {\n    & em {\n      color: var(--x);\n    }\n  }\n}\n', 'p {\n  & span {\n    color: var(--x);\n  }\n}\n'],
  ['selector-max-id', '#a {\n  color: var(--x);\n}\n', '.a {\n  color: var(--x);\n}\n'],
  ['selector-no-qualifying-type', 'p.a {\n  color: var(--x);\n}\n', '.a {\n  color: var(--x);\n}\n'],
  ['declaration-no-important', '.a {\n  color: var(--x) !important;\n}\n', '.a {\n  color: var(--x);\n}\n'],
  ['color-named', '.a {\n  color: red;\n}\n', '.a {\n  color: var(--danger);\n}\n'],
  ['font-weight-notation', '.a {\n  font-weight: bold;\n}\n', '.a {\n  font-weight: 700;\n}\n'],
  ['declaration-property-unit-allowed-list', '.a {\n  font-size: 120%;\n}\n', '.a {\n  inline-size: 50%;\n}\n'],
  ['logical-css/require-logical-properties', '.a {\n  margin-left: 0;\n}\n', '.a {\n  margin-inline-start: 0;\n}\n'],
  ['logical-css/require-logical-keywords', '.a {\n  float: left;\n}\n', '.a {\n  float: inline-start;\n}\n'],
  ['logical-css/require-logical-units', '.a {\n  inline-size: 50vw;\n}\n', '.a {\n  inline-size: 50%;\n}\n'],
  ['plugin/no-unsupported-browser-features', '.a {\n  initial-letter: 2;\n}\n', '.a {\n  display: grid;\n}\n'],
  ['scale-unlimited/declaration-strict-value', '.a {\n  color: #fff;\n}\n', '.a {\n  color: var(--ink);\n}\n'],
  ['scale-unlimited/declaration-strict-value', '.a {\n  z-index: 3;\n}\n', '.a {\n  z-index: var(--layer-top);\n}\n'],
  ['scale-unlimited/declaration-strict-value', `.a {\n  transition-duration: 200ms;\n}${  RM}`, `.a {\n  transition-duration: var(--quick);\n}${  RM}`],
  ['scale-unlimited/declaration-strict-value', `.a {\n  transition-timing-function: ease-in;\n}${  RM}`, `.a {\n  transition-timing-function: var(--ease-out);\n}${  RM}`],
  ['a11y/content-property-no-static-value', '.a::before {\n  content: "New";\n}\n', '.a::before {\n  content: "";\n}\n'],
  ['a11y/font-size-is-readable', '.a {\n  font-size: 12px;\n}\n', '.a {\n  font-size: var(--text-body);\n}\n'],
  ['a11y/line-height-is-vertical-rhythmed', '.a {\n  line-height: 1.2;\n}\n', '.a {\n  line-height: 1.5;\n}\n'],
  ['a11y/media-prefers-color-scheme', '.a {\n  color: #000;\n}\n', '.a {\n  color: var(--ink);\n}\n'],
  ['a11y/media-prefers-reduced-motion', '.a {\n  transition: opacity var(--quick) var(--ease-out);\n}\n', `.a {\n  transition: opacity var(--quick) var(--ease-out);\n}${  RM}`],
  ['a11y/no-display-none', '.a {\n  display: none;\n}\n', '.a {\n  display: block;\n}\n'],
  ['a11y/no-obsolete-attribute', '[dropzone] {\n  color: var(--x);\n}\n', '[hidden] {\n  color: var(--x);\n}\n'],
  ['a11y/no-obsolete-element', 'blink {\n  color: var(--x);\n}\n', 'em {\n  color: var(--x);\n}\n'],
  ['a11y/no-outline-none', '.a:focus {\n  outline: none;\n}\n', '.a:focus {\n  outline: var(--focus-ring);\n}\n'],
  ['a11y/no-spread-text', '.a {\n  text-align: start;\n  max-width: 120ch;\n}\n', '.a {\n  text-align: start;\n  max-inline-size: var(--measure);\n}\n'],
  ['a11y/no-text-align-justify', '.a {\n  text-align: justify;\n}\n', '.a {\n  text-align: start;\n}\n'],
  ['a11y/selector-pseudo-class-focus', '.a:hover {\n  color: var(--x);\n}\n', '.a:hover,\n.a:focus {\n  color: var(--x);\n}\n'],
  ['harness/design-tokens', '.a {\n  padding-inline: 1rem;\n}\n', '.a {\n  padding-inline: var(--gap);\n}\n'],
];

describe('the lint, on planted sheets', () => {
  test('every rule the configuration turns on has a plant', () => {
    expect([...new Set(PLANTS.map(([rule]) => rule))].toSorted()).toEqual(configuredRules().toSorted());
  });

  test.each(PLANTS)('%s fails its plant and passes its near miss', async (rule, failing, passing) => {
    await expect(lintText('plant/theme.css', failing)).resolves.toContain(rule);
    await expect(lintText('plant/theme.css', passing)).resolves.toEqual([]);
  });

  test('a token file defines raw values; a custom property anywhere else may not', async () => {
    const tokens = ':root {\n  --gap: 0.5rem;\n  --ink: #111;\n  --quick: 150ms;\n  --layer-top: 10;\n}\n';
    await expect(lintText('plant/tokens.css', tokens)).resolves.toEqual([]);
    await expect(lintText('plant/theme.css', tokens)).resolves.toEqual([
      'harness/design-tokens',
      'harness/design-tokens',
      'harness/design-tokens',
      'harness/design-tokens',
    ]);
  });

  test('reads a stylesheet written in a module', async () => {
    const module = "import { css } from 'lit';\nexport const styles = css`\n  .a {\n    color: #fff;\n  }\n`;\n";
    expect(sheetsOf('plant/part.ts', module).map((sheet) => sheet.line)).toEqual([2]);
    await expect(lintText('plant/part.ts', module)).resolves.toContain('scale-unlimited/declaration-strict-value');
  });

  test('the token rule lets zero, unitless numbers and var() through', () => {
    expect(rawSizes('0 var(--gap)')).toEqual([]);
    expect(rawSizes('1.5')).toEqual([]);
    expect(rawSizes('var(--space-4px)')).toEqual([]);
    expect(rawTokenValues('var(--a)')).toEqual([]);
    expect(rawTokenValues('0')).toEqual([]);
  });
});

/** A planted sheet starting on the first line of its file. */
function plantedSheet(path: string, text: string): Sheet {
  return { line: 1, path, text };
}

describe('the cross-sheet scans, on planted sheets', () => {
  test('sees a custom property defined but never read, and one read but never defined', async () => {
    const tokens = plantedSheet('plant/tokens.css', ':root {\n  --gap: 8px;\n  --unread: 1px;\n}\n');
    const theme = plantedSheet('plant/theme.css', '.a {\n  padding: var(--gap) var(--undefined);\n}\n');
    await expect(customPropertyProblems([tokens, theme], new Map([['plant/a.ts', "el.className = 'a';"]]))).resolves.toEqual([
      { line: 0, path: 'plant/tokens.css', rule: 'custom-property-unread', text: '--unread' },
      { line: 0, path: '', rule: 'custom-property-undefined', text: '--undefined' },
    ]);
  });

  test('counts a property a module sets or reads', async () => {
    const theme = plantedSheet('plant/theme.css', '.a {\n  color: var(--from-module);\n}\n');
    const module = new Map([['plant/a.ts', "el.style.setProperty('--from-module', value);\nconst x = 'var(--theme)';"]]);
    const tokens = plantedSheet('plant/tokens.css', ':root {\n  --theme: 1px;\n}\n');
    await expect(customPropertyProblems([theme, tokens], module)).resolves.toEqual([]);
  });

  test('sees a class no module names, and lets a named class through', async () => {
    const theme = plantedSheet('plant/theme.css', '.used, .card-unused {\n  color: var(--ink);\n}\n');
    const modules = new Map([['plant/a.tsx', 'return <p class="used">hi</p>;']]);
    expect((await unusedClasses([theme], modules)).map((finding) => finding.text)).toEqual(['card-unused']);
  });

  test('a class named only inside its own sheet is unused, and one its module names is used', async () => {
    const own = "export const styles = css`.lonely { color: var(--ink); }`;\n";
    const lonely = new Map([['plant/part.ts', withoutSheets('plant/part.ts', own)]]);
    expect((await unusedClasses(sheetsOf('plant/part.ts', own), lonely)).map((finding) => finding.text)).toEqual(['lonely']);
    const named = `${own}export const view = '<p class="lonely"></p>';\n`;
    const used = new Map([['plant/part.ts', withoutSheets('plant/part.ts', named)]]);
    await expect(unusedClasses(sheetsOf('plant/part.ts', named), used)).resolves.toEqual([]);
  });

  test('reads a substitution in a sheet as a value, and a css string in a string literal as no sheet', () => {
    const module = "const gap = 'var(--gap)';\nexport const s = css`.a { padding: ${gap}; }`;\nconst note = 'css`.b {}`';\n";
    expect(sheetsOf('plant/part.ts', module).map((sheet) => sheet.text)).toEqual(['.a { padding: 0; }']);
  });

  test('sees a selector written twice in one media context, and lets one per context through', async () => {
    const twice = plantedSheet('plant/theme.css', '.a {\n  color: var(--x);\n}\n\n.a {\n  margin: 0;\n}\n');
    expect((await duplicateRules(twice)).map((finding) => finding.line)).toEqual([5]);
    const media = plantedSheet(
      'plant/theme.css',
      '.a {\n  color: var(--x);\n}\n\n@media (width >= 40rem) {\n  .a {\n    margin: 0;\n  }\n}\n',
    );
    await expect(duplicateRules(media)).resolves.toEqual([]);
    const nested = plantedSheet('plant/theme.css', '@media print {\n  .a, .b {\n    margin: 0;\n  }\n\n  .b, .a {\n    color: var(--x);\n  }\n}\n');
    expect((await duplicateRules(nested)).map((finding) => finding.text)).toEqual(['@media print :: .a, .b']);
  });
});
