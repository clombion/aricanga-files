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

import { CountedExemptions, site } from '../lib/exemptions.ts';
import {
  customPropertyProblems,
  duplicateRules,
  lintSheet,
  readers,
  type Sheet,
  type SheetFinding,
  sheets,
  sheetsOf,
  unusedClasses,
  withoutSheets,
} from '../lib/stylesheets.ts';
import { rawValues } from '../stylelint/design-tokens.ts';

export const HARNESS_ID = 'stylesheets';

/** Lint findings the rebuild still carries, keyed by (path, rule), with their counts. */
const LINT_DEBT = new CountedExemptions({
  [site('experiences/sandbox/src/sk-message.ts', 'harness/design-tokens')]: [
    5,
    'adopting: the Solid message part that replaces the Lit SkMessage reads its sizes and colour from design tokens',
  ],
  [site('experiences/sandbox/src/sk-message.ts', 'rule-empty-line-before')]: [
    1,
    'adopting: the Solid message part that replaces the Lit SkMessage is formatted by the standard config',
  ],
});

const key = (finding: SheetFinding): string => site(finding.path, finding.rule);

async function lintText(path: string, text: string): Promise<readonly string[]> {
  const findings = await Promise.all(sheetsOf(path, text).map(lintSheet));
  return findings.flat().map((finding) => finding.rule);
}

describe('the repository', () => {
  test('every sheet passes the lint, but for its counted debt', async () => {
    const findings = (await Promise.all(sheets().map(lintSheet))).flat();
    expect(LINT_DEBT.mismatches(findings.map(key))).toEqual([]);
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

describe('the lint, on planted sheets', () => {
  test.each([
    ['a size', '.a {\n  inline-size: 12px;\n}\n'],
    ['a colour', '.a {\n  color: #e9e9eb;\n}\n'],
    ['a named colour', '.a {\n  color: tomato;\n}\n'],
    ['a colour function', '.a {\n  color: oklch(70% 0.1 200deg);\n}\n'],
    ['a duration', '.a {\n  transition-duration: 200ms;\n}\n'],
    ['an easing', '.a {\n  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);\n}\n'],
    ['a z-index', '.a {\n  z-index: 10;\n}\n'],
    ['a raw value in a custom property outside the tokens', ':root {\n  --gap: 8px;\n}\n'],
  ])('refuses %s outside the design tokens', async (_kind, text) => {
    expect(await lintText('plant/theme.css', text)).toEqual(['harness/design-tokens']);
  });

  test('lets a token definition and a token read through', async () => {
    expect(await lintText('plant/tokens.css', ':root {\n  --gap: 8px;\n  --ink: #111;\n}\n')).toEqual([]);
    const reads = '.a {\n  padding-inline: var(--gap);\n  color: var(--ink);\n  margin-block: 0;\n  line-height: 1.4;\n}\n';
    expect(await lintText('plant/theme.css', reads)).toEqual([]);
  });

  test('refuses a physical property, and lets its logical twin through', async () => {
    expect(await lintText('plant/theme.css', '.a {\n  margin-left: 0;\n}\n')).toEqual([
      'logical-css/require-logical-properties',
    ]);
    expect(await lintText('plant/theme.css', '.a {\n  margin-inline-start: 0;\n}\n')).toEqual([]);
  });

  test('refuses a feature a supported browser lacks, and lets a supported one through', async () => {
    expect(await lintText('plant/theme.css', '.a {\n  initial-letter: 2;\n}\n')).toEqual([
      'plugin/no-unsupported-browser-features',
    ]);
    expect(await lintText('plant/theme.css', '.a {\n  display: grid;\n}\n')).toEqual([]);
  });

  test('reads a stylesheet written in a module', async () => {
    const module = "import { css } from 'lit';\nexport const styles = css`\n  .a {\n    color: red;\n  }\n`;\n";
    expect(sheetsOf('plant/part.ts', module).map((sheet) => sheet.line)).toEqual([2]);
    expect(await lintText('plant/part.ts', module)).toEqual(['harness/design-tokens']);
  });

  test('the token rule sees each raw kind and lets zero, unitless and var() through', () => {
    expect(rawValues('transition', 'opacity 0.2s ease-out').map(([kind]) => kind)).toEqual(['duration', 'easing']);
    expect(rawValues('margin', '0 var(--gap)')).toEqual([]);
    expect(rawValues('line-height', '1.4')).toEqual([]);
    expect(rawValues('z-index', 'var(--layer-top)')).toEqual([]);
    expect(rawValues('background', 'linear-gradient(var(--a), var(--b))')).toEqual([]);
    expect(rawValues('inline-size', 'var(--space-4px)')).toEqual([]);
  });
});

describe('the cross-sheet scans, on planted sheets', () => {
  const sheet = (path: string, text: string): Sheet => ({ path, line: 1, text });

  test('sees a custom property defined but never read, and one read but never defined', async () => {
    const tokens = sheet('plant/tokens.css', ':root {\n  --gap: 8px;\n  --unread: 1px;\n}\n');
    const theme = sheet('plant/theme.css', '.a {\n  padding: var(--gap) var(--undefined);\n}\n');
    expect(await customPropertyProblems([tokens, theme], new Map([['plant/a.ts', "el.className = 'a';"]]))).toEqual([
      { path: 'plant/tokens.css', line: 0, rule: 'custom-property-unread', text: '--unread' },
      { path: '', line: 0, rule: 'custom-property-undefined', text: '--undefined' },
    ]);
  });

  test('counts a property a module sets or reads', async () => {
    const theme = sheet('plant/theme.css', '.a {\n  color: var(--from-module);\n}\n');
    const module = new Map([['plant/a.ts', "el.style.setProperty('--from-module', value);\nconst x = 'var(--theme)';"]]);
    const tokens = sheet('plant/tokens.css', ':root {\n  --theme: 1px;\n}\n');
    expect(await customPropertyProblems([theme, tokens], module)).toEqual([]);
  });

  test('sees a class no module names, and lets a named class through', async () => {
    const theme = sheet('plant/theme.css', '.used, .card-unused {\n  color: var(--ink);\n}\n');
    const modules = new Map([['plant/a.tsx', 'return <p class="used">hi</p>;']]);
    expect((await unusedClasses([theme], modules)).map((finding) => finding.text)).toEqual(['card-unused']);
  });

  test('a class named only inside its own sheet is unused, and one its module names is used', async () => {
    const own = "export const styles = css`.lonely { color: var(--ink); }`;\n";
    const lonely = new Map([['plant/part.ts', withoutSheets('plant/part.ts', own)]]);
    expect((await unusedClasses(sheetsOf('plant/part.ts', own), lonely)).map((finding) => finding.text)).toEqual(['lonely']);
    const named = `${own}export const view = '<p class="lonely"></p>';\n`;
    const used = new Map([['plant/part.ts', withoutSheets('plant/part.ts', named)]]);
    expect(await unusedClasses(sheetsOf('plant/part.ts', named), used)).toEqual([]);
  });

  test('reads a substitution in a sheet as a value, and a css string in a string literal as no sheet', () => {
    const module = "const gap = 'var(--gap)';\nexport const s = css`.a { padding: ${gap}; }`;\nconst note = 'css`.b {}`';\n";
    expect(sheetsOf('plant/part.ts', module).map((sheet) => sheet.text)).toEqual(['.a { padding: 0; }']);
  });

  test('sees a selector written twice in one media context, and lets one per context through', async () => {
    const twice = sheet('plant/theme.css', '.a {\n  color: var(--x);\n}\n\n.a {\n  margin: 0;\n}\n');
    expect((await duplicateRules(twice)).map((finding) => finding.line)).toEqual([5]);
    const media = sheet(
      'plant/theme.css',
      '.a {\n  color: var(--x);\n}\n\n@media (width >= 40rem) {\n  .a {\n    margin: 0;\n  }\n}\n',
    );
    expect(await duplicateRules(media)).toEqual([]);
    const nested = sheet('plant/theme.css', '@media print {\n  .a, .b {\n    margin: 0;\n  }\n\n  .b, .a {\n    color: var(--x);\n  }\n}\n');
    expect((await duplicateRules(nested)).map((finding) => finding.text)).toEqual(['@media print :: .a, .b']);
  });
});
