/**
 * The one owner of the harness's stylesheet scans. A sheet is a held `.css` file or a `css`
 * tagged template in a held module (found in the module's syntax tree, read through
 * `ts-source.ts`); every sheet is linted with
 * `.stylelintrc.json`, and three scans read across sheets: custom properties defined and read,
 * classes used, and one rule per selector in each media context. Sheets parse through stylelint's
 * own postcss, handed back by a one-rule collector plugin.
 */

import type { Rule, RuleBase } from 'stylelint';
import { isIdentifier, isNoSubstitutionTemplateLiteral, isTaggedTemplateExpression } from 'typescript/unstable/ast/is';
import { nodes, parse as parseModule } from './ts-source.ts';
import { Prefixes } from './exemptions.ts';
import { Slot } from './lists.ts';
import { fromRoot } from './paths.ts';
import { heldFiles } from './scope.ts';
import stylelint from 'stylelint';
import { textOf } from './source-files.ts';

/** A sheet parsed by stylelint's postcss. */
type Root = ReturnType<RuleBase> extends (root: infer Parsed, ...rest: infer _Rest) => unknown ? Parsed : never;

/** A stylesheet and where it was written. */
interface Sheet {
  readonly path: string;
  /** The line of `path` the sheet's first line sits on. */
  readonly line: number;
  readonly text: string;
}

/** A finding in a sheet, at a line of the file it came from. */
interface SheetFinding {
  readonly path: string;
  readonly line: number;
  readonly rule: string;
  readonly text: string;
}

/** A `css` tagged template of a module: its text and its span in the module. */
interface Template {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** The files whose `css` tagged templates are sheets. */
const MODULES = new Prefixes(['.ts', '.tsx']);

/** The harness holds planted sheets and values in its checks; the scans read the product only. */
const PLANTS = new Prefixes(['harness/']);


/** The first line of a file or sheet. */
const FIRST_LINE = 1;

/** The length of the backtick that opens and closes a template. */
const BACKTICK = 1;

/** The index of a text's first character. */
const TEXT_START = 0;

/** What a template substitution reads as: a number, so the sheet parses. */
const SUBSTITUTION = '0';

/**
 * The held files of the product with the given suffixes.
 *
 * @param {readonly string[]} suffixes - The suffixes.
 * @returns {readonly string[]} The files.
 */
function productFiles(...suffixes: readonly string[]): readonly string[] {
  return heldFiles(...suffixes).filter((path) => !PLANTS.starts(path));
}

/**
 * The `css` tagged templates of a module: their text (a substitution reads as `0`) and span.
 *
 * @param {string} path - The module's path.
 * @param {string} text - Its text.
 * @returns {readonly Template[]} The templates.
 */
function cssTemplates(path: string, text: string): readonly Template[] {
  return nodes(parseModule(path, text)).flatMap((node) => {
    if (!isTaggedTemplateExpression(node) || !isIdentifier(node.tag) || node.tag.text !== 'css') {
      return [];
    }
    const { template } = node;
    const body = isNoSubstitutionTemplateLiteral(template)
      ? template.text
      : template.head.text + template.templateSpans.map((span) => `${SUBSTITUTION}${span.literal.text}`).join('');
    return [{ end: template.end - BACKTICK, start: text.indexOf('`', template.pos) + BACKTICK, text: body }];
  });
}

/**
 * The line a character of a text sits on.
 *
 * @param {string} text - The text.
 * @param {number} index - The character's index.
 * @returns {number} Its 1-based line.
 */
function lineAt(text: string, index: number): number {
  return text.slice(TEXT_START, index).split('\n').length;
}

/**
 * The sheets one file holds: the whole file for `.css`, each `css` tagged template for a module.
 *
 * @param {string} path - The file's path.
 * @param {string} text - Its text.
 * @returns {readonly Sheet[]} Its sheets.
 */
function sheetsOf(path: string, text: string): readonly Sheet[] {
  if (path.endsWith('.css')) {
    return [{ line: FIRST_LINE, path, text }];
  }
  return cssTemplates(path, text).map((template) => ({ line: lineAt(text, template.start), path, text: template.text }));
}

/**
 * A module's text with its `css` templates blanked, so a sheet never counts as its own reader.
 *
 * @param {string} path - The module's path.
 * @param {string} text - Its text.
 * @returns {string} The text with every template's body replaced by spaces.
 */
function withoutSheets(path: string, text: string): string {
  if (!MODULES.ends(path)) {
    return text;
  }
  let blanked = text;
  for (const template of cssTemplates(path, text)) {
    blanked = blanked.slice(TEXT_START, template.start) + ' '.repeat(template.end - template.start) + blanked.slice(template.end);
  }
  return blanked;
}

/**
 * Every held sheet of the product.
 *
 * @returns {readonly Sheet[]} The sheets.
 */
function sheets(): readonly Sheet[] {
  return productFiles('.css', ...MODULES.values).flatMap((path) => sheetsOf(path, textOf(path)));
}

/**
 * The product's modules and pages a class or custom property may be read from, without their sheets.
 *
 * @returns {ReadonlyMap<string, string>} Each reader's text, by path.
 */
function readers(): ReadonlyMap<string, string> {
  return new Map(productFiles('.html', ...MODULES.values).map((path) => [path, withoutSheets(path, textOf(path))] as const));
}

/**
 * Lint one sheet with the repository's stylelint configuration.
 *
 * @param {Sheet} sheet - The sheet.
 * @returns {Promise<readonly SheetFinding[]>} Its warnings, at lines of its file.
 */
async function lintSheet(sheet: Sheet): Promise<readonly SheetFinding[]> {
  const codeFilename = sheet.path.endsWith('.css') ? fromRoot(sheet.path) : `${fromRoot(sheet.path)}.css`;
  const linted = await stylelint.lint({ code: sheet.text, codeFilename, configFile: fromRoot('.stylelintrc.json') });
  const findings: SheetFinding[] = [];
  for (const result of linted.results) {
    for (const warning of result.warnings) {
      findings.push({ line: sheet.line + warning.line - FIRST_LINE, path: sheet.path, rule: warning.rule, text: warning.text });
    }
  }
  return findings;
}

/**
 * Parse a sheet with stylelint's postcss.
 *
 * @param {string} text - The sheet's text.
 * @returns {Promise<Root>} The parsed sheet.
 */
async function parse(text: string): Promise<Root> {
  const captured = new Slot<Root>();
  const collect: Rule = () => (root) => {
    captured.put(root);
  };
  collect.ruleName = 'harness/collect';
  collect.messages = {};
  await stylelint.lint({
    code: text,
    config: { plugins: [stylelint.createPlugin('harness/collect', collect)], rules: { 'harness/collect': true } },
  });
  const root = captured.take();
  if (root === undefined) {
    throw new Error('stylelint ran no rule over the sheet');
  }
  return root;
}

export { lintSheet, parse, readers, sheets, sheetsOf, withoutSheets };
export type { Sheet, SheetFinding };
