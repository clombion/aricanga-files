/**
 * The scans that read across the product's stylesheets: custom properties defined and read, classes
 * used, and one rule per selector in each media context. Sheets parse through `stylesheets.ts`.
 */

import type { Sheet, SheetFinding } from './stylesheets.ts';
import { parse } from './stylesheets.ts';

/** The custom properties a sheet or module defines and reads. */
interface Properties {
  readonly path: string;
  readonly defined: readonly string[];
  readonly read: readonly string[];
}

const CUSTOM_READ = /var\(\s*(?<name>--[\w-]+)/gu;
const SET_PROPERTY = /\.setProperty\(\s*['"`](?<name>--[\w-]+)/gu;
const CLASS = /\.(?<name>-?[_a-zA-Z][\w-]*)/gu;

/** The first line of a sheet. */
const FIRST_LINE = 1;

/** The line a cross-sheet finding names: none, since it spans sheets. */
const NO_LINE = 0;

/**
 * The names a pattern's `name` group captures in a text.
 *
 * @param {string} text - The text.
 * @param {Readonly<RegExp>} pattern - A global pattern with a `name` group.
 * @returns {readonly string[]} The names.
 */
function namesIn(text: string, pattern: Readonly<RegExp>): readonly string[] {
  const names: string[] = [];
  for (const match of text.matchAll(pattern)) {
    names.push(match.groups?.['name'] ?? '');
  }
  return names;
}

/**
 * The custom properties each sheet defines and reads.
 *
 * @param {readonly Sheet[]} all - The sheets.
 * @returns {Promise<readonly Properties[]>} Each sheet's definitions and reads.
 */
async function sheetProperties(all: readonly Sheet[]): Promise<readonly Properties[]> {
  const parsed = await Promise.all(
    all.map(async (sheet) => {
      const root = await parse(sheet.text);
      const defined: string[] = [];
      const read: string[] = [];
      root.walkDecls((declaration) => {
        if (declaration.prop.startsWith('--')) {
          defined.push(declaration.prop);
        }
        read.push(...namesIn(declaration.value, CUSTOM_READ));
      });
      return { defined, path: sheet.path, read };
    }),
  );
  return parsed;
}

/**
 * The custom properties defined but never read, and read but never defined, across sheets and modules.
 *
 * @param {readonly Sheet[]} all - The sheets.
 * @param {Readonly<ReadonlyMap<string, string>>} modules - Each reader's text, by path.
 * @returns {Promise<readonly SheetFinding[]>} The findings.
 */
async function customPropertyProblems(all: readonly Sheet[], modules: Readonly<ReadonlyMap<string, string>>): Promise<readonly SheetFinding[]> {
  const sources: readonly Properties[] = [
    ...(await sheetProperties(all)),
    ...[...modules].map(([path, text]: readonly [string, string]) => ({ defined: namesIn(text, SET_PROPERTY), path, read: namesIn(text, CUSTOM_READ) })),
  ];
  const defined = new Map(sources.flatMap((source) => source.defined.map((name) => [name, source.path] as const)));
  const read = new Set(sources.flatMap((source) => source.read));
  return [
    ...[...defined]
      .filter(([name]: readonly [string, string]) => !read.has(name))
      .map(([name, path]: readonly [string, string]) => ({ line: NO_LINE, path, rule: 'custom-property-unread', text: name })),
    ...[...read]
      .filter((name) => !defined.has(name))
      .map((name) => ({ line: NO_LINE, path: '', rule: 'custom-property-undefined', text: name })),
  ];
}

/**
 * The classes a sheet defines that no held module or page names.
 *
 * @param {readonly Sheet[]} all - The sheets.
 * @param {Readonly<ReadonlyMap<string, string>>} modules - Each reader's text, by path.
 * @returns {Promise<readonly SheetFinding[]>} The findings.
 */
async function unusedClasses(all: readonly Sheet[], modules: Readonly<ReadonlyMap<string, string>>): Promise<readonly SheetFinding[]> {
  const texts = [...modules.values()];
  const perSheet = await Promise.all(
    all.map(async (sheet) => {
      const root = await parse(sheet.text);
      const found: SheetFinding[] = [];
      root.walkRules((rule) => {
        for (const name of namesIn(rule.selector, CLASS)) {
          const named = new RegExp(`(?<![\\w-])${name}(?![\\w-])`, 'u');
          if (!texts.some((text) => named.test(text))) {
            const line = sheet.line + (rule.source?.start?.line ?? FIRST_LINE) - FIRST_LINE;
            found.push({ line, path: sheet.path, rule: 'class-unused', text: name });
          }
        }
      });
      return found;
    }),
  );
  return perSheet.flat();
}

/**
 * The selectors a sheet writes twice in one media context (the chain of enclosing at-rules).
 *
 * @param {Sheet} sheet - The sheet.
 * @returns {Promise<readonly SheetFinding[]>} The findings.
 */
async function duplicateRules(sheet: Sheet): Promise<readonly SheetFinding[]> {
  const seen = new Set<string>();
  const found: SheetFinding[] = [];
  const root = await parse(sheet.text);
  root.walkRules((rule) => {
    const context: string[] = [];
    for (let { parent } = rule; parent !== undefined && parent.type !== 'root'; ({ parent } = parent)) {
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
      const line = sheet.line + (rule.source?.start?.line ?? FIRST_LINE) - FIRST_LINE;
      found.push({ line, path: sheet.path, rule: 'selector-repeated', text: key });
    }
    seen.add(key);
  });
  return found;
}

export { customPropertyProblems, duplicateRules, unusedClasses };
