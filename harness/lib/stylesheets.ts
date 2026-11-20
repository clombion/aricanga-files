/**
 * The one owner of the harness's stylesheet scans. A sheet is a held `.css` file or a `css`
 * tagged template in a held module (found in the module's syntax tree, read through
 * `ts-source.ts`); every sheet is linted with
 * `.stylelintrc.json`, and three scans read across sheets: custom properties defined and read,
 * classes used, and one rule per selector in each media context. Sheets parse through stylelint's
 * own postcss, handed back by a one-rule collector plugin.
 */

import stylelint, { type Rule, type RuleBase } from 'stylelint';
import {
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  isTaggedTemplateExpression,
} from 'typescript/unstable/ast/is';

import { Prefixes } from './exemptions.ts';
import { fromRoot } from './paths.ts';
import { heldFiles } from './scope.ts';
import { textOf } from './source-files.ts';
import { nodes, parse as parseModule } from './ts-source.ts';

type Root = Parameters<ReturnType<RuleBase>>[0];

/** A stylesheet and where it was written. */
export interface Sheet {
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

/** The files whose `css` tagged templates are sheets. */
const MODULES = new Prefixes(['.ts', '.tsx']);

/** The harness holds planted sheets and values in its checks; the scans read the product only. */
const PLANTS = new Prefixes(['harness/']);

function productFiles(...suffixes: string[]): readonly string[] {
  return heldFiles(...suffixes).filter((path) => !PLANTS.starts(path));
}

/** The `css` tagged templates of a module: their text (a substitution reads as `0`) and span. */
function cssTemplates(
  path: string,
  text: string,
): readonly { readonly text: string; readonly start: number; readonly end: number }[] {
  const file = parseModule(path, text);
  return nodes(file).flatMap((node) => {
    if (!isTaggedTemplateExpression(node) || !isIdentifier(node.tag) || node.tag.text !== 'css') {
      return [];
    }
    const template = node.template;
    const body = isNoSubstitutionTemplateLiteral(template)
      ? template.text
      : template.head.text + template.templateSpans.map((span) => `0${span.literal.text}`).join('');
    return [{ text: body, start: text.indexOf('`', template.pos) + 1, end: template.end - 1 }];
  });
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/** The sheets one file holds: the whole file for `.css`, each `css` tagged template for a module. */
export function sheetsOf(path: string, text: string): readonly Sheet[] {
  if (path.endsWith('.css')) {
    return [{ path, line: 1, text }];
  }
  return cssTemplates(path, text).map((template) => ({ path, line: lineAt(text, template.start), text: template.text }));
}

/** A module's text with its `css` templates blanked, so a sheet never counts as its own reader. */
export function withoutSheets(path: string, text: string): string {
  if (!MODULES.ends(path)) {
    return text;
  }
  let blanked = text;
  for (const template of cssTemplates(path, text)) {
    blanked = blanked.slice(0, template.start) + ' '.repeat(template.end - template.start) + blanked.slice(template.end);
  }
  return blanked;
}

/** Every held sheet of the product. */
export function sheets(): readonly Sheet[] {
  return productFiles('.css', ...MODULES.values).flatMap((path) => sheetsOf(path, textOf(path)));
}

/** The product's modules and pages a class or custom property may be read from, without their sheets. */
export function readers(): ReadonlyMap<string, string> {
  return new Map(productFiles('.html', ...MODULES.values).map((path) => [path, withoutSheets(path, textOf(path))]));
}

/** Lint one sheet with the repository's stylelint configuration. */
export async function lintSheet(sheet: Sheet): Promise<readonly SheetFinding[]> {
  const codeFilename = sheet.path.endsWith('.css') ? fromRoot(sheet.path) : `${fromRoot(sheet.path)}.css`;
  const linted = await stylelint.lint({ code: sheet.text, codeFilename, configFile: fromRoot('.stylelintrc.json') });
  return linted.results.flatMap((result) =>
    result.warnings.map((warning) => ({
      path: sheet.path,
      line: sheet.line + warning.line - 1,
      rule: warning.rule,
      text: warning.text,
    })),
  );
}

/** Parse a sheet with stylelint's postcss. */
async function parse(text: string): Promise<Root> {
  let captured: Root | undefined;
  const collect: Rule = () => (root) => {
    captured = root;
  };
  collect.ruleName = 'harness/collect';
  collect.messages = {};
  await stylelint.lint({
    code: text,
    config: { plugins: [stylelint.createPlugin('harness/collect', collect)], rules: { 'harness/collect': true } },
  });
  if (captured === undefined) {
    throw new Error('stylelint ran no rule over the sheet');
  }
  return captured;
}

const CUSTOM_READ = /var\(\s*(--[\w-]+)/g;
const SET_PROPERTY = /\.setProperty\(\s*['"`](--[\w-]+)/g;

/** The custom properties defined but never read, and read but never defined, across sheets and modules. */
export async function customPropertyProblems(
  all: readonly Sheet[],
  modules: ReadonlyMap<string, string>,
): Promise<readonly SheetFinding[]> {
  const defined = new Map<string, string>();
  const read = new Set<string>();
  const roots = await Promise.all(all.map(async (sheet) => ({ sheet, root: await parse(sheet.text) })));
  for (const { sheet, root } of roots) {
    root.walkDecls((declaration) => {
      if (declaration.prop.startsWith('--')) {
        defined.set(declaration.prop, sheet.path);
      }
      for (const match of declaration.value.matchAll(CUSTOM_READ)) {
        read.add(match[1] ?? '');
      }
    });
  }
  for (const [path, text] of modules) {
    for (const match of text.matchAll(SET_PROPERTY)) {
      defined.set(match[1] ?? '', path);
    }
    for (const match of text.matchAll(CUSTOM_READ)) {
      read.add(match[1] ?? '');
    }
  }
  return [
    ...[...defined]
      .filter(([name]) => !read.has(name))
      .map(([name, path]) => ({ path, line: 0, rule: 'custom-property-unread', text: name })),
    ...[...read]
      .filter((name) => !defined.has(name))
      .map((name) => ({ path: '', line: 0, rule: 'custom-property-undefined', text: name })),
  ];
}

const CLASS = /\.(-?[_a-zA-Z][\w-]*)/g;

/** The classes a sheet defines that no held module or page names. */
export async function unusedClasses(
  all: readonly Sheet[],
  modules: ReadonlyMap<string, string>,
): Promise<readonly SheetFinding[]> {
  const found: SheetFinding[] = [];
  const roots = await Promise.all(all.map(async (sheet) => ({ sheet, root: await parse(sheet.text) })));
  for (const { sheet, root } of roots) {
    root.walkRules((rule) => {
      for (const match of rule.selector.matchAll(CLASS)) {
        const name = match[1] ?? '';
        const named = new RegExp(`(?<![\\w-])${name}(?![\\w-])`);
        if (![...modules.values()].some((text) => named.test(text))) {
          const line = sheet.line + (rule.source?.start?.line ?? 1) - 1;
          found.push({ path: sheet.path, line, rule: 'class-unused', text: name });
        }
      }
    });
  }
  return found;
}

/** The selectors a sheet writes twice in one media context (the chain of enclosing at-rules). */
export async function duplicateRules(sheet: Sheet): Promise<readonly SheetFinding[]> {
  const seen = new Set<string>();
  const found: SheetFinding[] = [];
  (await parse(sheet.text)).walkRules((rule) => {
    const context: string[] = [];
    for (let parent = rule.parent; parent !== undefined && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'atrule' && 'name' in parent && 'params' in parent) {
        context.unshift(`@${parent.name} ${parent.params}`);
      }
    }
    const selector = rule.selector
      .split(',')
      .map((part) => part.trim())
      .toSorted()
      .join(', ');
    const key = `${context.join(' > ')} :: ${selector}`;
    if (seen.has(key)) {
      const line = sheet.line + (rule.source?.start?.line ?? 1) - 1;
      found.push({ path: sheet.path, line, rule: 'selector-repeated', text: key });
    }
    seen.add(key);
  });
  return found;
}
