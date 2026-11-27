/**
 * The fixers' writer writes a repository file as given, read back as written; and the held kinds are
 * stated once, in `TYPESCRIPT`: no other held module of the harness writes a held kind as a literal
 * of its own.
 *
 * The kinds are text at every site that names a file, so no type can keep a site from writing them;
 * where one can, it does (`heldFiles` takes no held kind, `OtherSuffixes`). This scan is the guard
 * for the rest. It reads the kinds' word, not a list of spellings: each place in a literal (a string,
 * a template's part, a pattern) where `ts` or `tsx` stands as a word. Each place is a file's name
 * (the word after a dot that follows a name, as in `process.ts`, `playwright.config.ts` or a
 * template's `${stem}.ts`) or the kind written on its own (alone, in a list, after a tool's name, in
 * a glob such as `{ts,tsx}`, in a pattern over the extension, or in a name whose last segment holds a
 * wildcard: such a name selects many modules by their kind, whatever its stem spells, as in `*.ts`,
 * `*.test.ts`, `*-test.ts`, `x*.test.ts` or `playwright.*.config.ts`; a pattern's last segment
 * follows its last `/` or its last any-path `.*`, and its wildcards are its quantifiers, classes and
 * groups). Outside the tests, a literal holding the kind on its own is refused, but a restatement
 * of a tool's own setting, exempted with its reason (`RESTATED`). In a test or a test's plants, whose
 * expected values and planted paths are written out, a literal that is a kind alone, and a pattern
 * holding the kind on its own, are refused. Every module of the harness's code (`harnessModules`, its
 * root configuration modules included) is read but the owner and this scan, whose plants spell the kinds.
 */

import { Accepted, Exemptions } from '#lint-rules/exemptions.ts';
import { TYPESCRIPT, textOf, textsOf, typescriptGlob, typescriptKind, writeText } from '#lib/source-files.ts';
import { describe, expect, test } from 'vitest';
import {
  isNoSubstitutionTemplateLiteral,
  isRegularExpressionLiteral,
  isStringLiteral,
  isTemplateHead,
  isTemplateMiddle,
  isTemplateTail,
} from 'typescript/unstable/ast';
import { mkdir, rm } from 'node:fs/promises';
import { nodes, parse } from '#lib/ts-source.ts';
import { fromRoot } from '#lib/paths.ts';
import { harnessModules } from '#lib/holders.ts';
import { population } from '#lib/scope.ts';

/** The one statement of the held kinds, and the scan, whose plants spell them: the two modules it does not read. */
const UNREAD = new Accepted(['harness/lib/source-files.ts', 'harness/checks/source-files.test.ts']);

/** The kinds' word: `ts` or `tsx` standing as a word, not a part of one (`tsc`, `mts`, `ts-source`, `@ts-expect-error`). */
const KIND_WORD = /(?<![\w@-])tsx?(?![\w-])(?<optional>\?)?/gu;

/** A file's name before the word: a dot that follows a name's last character. */
const NAMED = /[\w)\]}-]\.$/u;

/** How a name's last segment is read: what comes before it, and the wildcards that make it select many modules. */
interface Reading {
  readonly path: RegExp;
  readonly wildcard: RegExp;
}

/** The two grammars a literal names files in. */
type Grammar = 'glob' | 'pattern';

/** A glob's reading: its directories run to its last `/`, and its wildcards are a glob's. */
const GLOB: Reading = { path: /^.*\//su, wildcard: /[*?[{]/u };

/** A pattern's reading: its directories run to its last `/` or any path (`.*`), and its wildcards are its quantifiers, classes and groups. */
const PATTERN: Reading = { path: /^.*(?:\/|\.\*)/su, wildcard: /[*+?[{(]|\\[dDsSwW]/u };

/** Literals that restate a tool's own setting, not the held kinds, keyed `path: text`, each with the setting it restates. */
const RESTATED = new Exemptions({
  'harness/lib/test-globs.ts: **/*.spec.ts':
    "Playwright's own testMatch for the suites (packages/characterisation/browsers.ts), which runs .ts specs only: a member's setting, restated",
});

/** A literal that is a kind alone: the kind's word, its dot or a tool's name before it, and nothing else. */
const KIND_ALONE = /^(?:[\w-]+:)?\.?tsx?$/u;

/** The stems that make a module a test or a test's plants, their kind taken off. */
const TEST_STEM = /\.(?:test|plants)$/u;

/** Where a path's stem starts. */
const START = 0;

/** The literals of the planted test: kinds on their own, globs of every module of a kind, patterns over the extension, and names of files. */
const PLANTED_KINDS = [
  "export const alone = ['.ts', 'oxlint:.ts', 'ts', 'tsx'];",
  "export const globs = ['src/**/*.{ts,tsx}', '**/*.tsx', '**/*.test.{ts,tsx,mts}', '*.{tsx,ts}', '**/*.test.ts', 'x/*.d.ts'];",
  "export const stems = ['**/*-test.ts', '**/?*.test.ts', '**/x*.test.ts', '**/playwright.*.config.ts', 'a/[ab].ts'];",
  String.raw`export const patterns = [/\.tsx?$/u, /^\.(?:ts|tsx)$/u, /\.ts$/u, /(?:\.ts)?$/u, /x\w*\.test\.ts$/u, /(a|b)\.ts$/u];`,
  'export const raw = String.raw`.*\\.(test|spec)\\.tsx?$`;',
  "export const named = ['harness/lib/process.ts', 'a.d.ts', '#lib/ts-source.ts', 'tsconfig.json', '**/playwright.config.ts', 'see (a/b.tsx)'];",
  `export const named2 = [/gen-docs\\.ts\\b/u, /set at .*isolation\\.test\\.ts:4/u, (stem: string): string => \`\${stem}.ts\`];`,
  '',
].join('\n');

/**
 * Whether a module is a test or a test's plants: its stem, its held kind taken off, ends `.test` or `.plants`.
 *
 * @param {string} path - The module's path.
 * @returns {boolean} Whether it is.
 */
function isTestModule(path: string): boolean {
  const kind = typescriptKind(path);
  return kind !== undefined && TEST_STEM.test(path.slice(START, path.length - kind.length));
}

/**
 * Whether a literal writes the kind on its own at some place: its word where it names no file.
 *
 * @param {string} text - The literal's text, a pattern's escaped dots taken as dots.
 * @param {boolean} part - Whether it is a template's part after a substitution.
 * @param {Grammar} grammar - The grammar its names are written in.
 * @returns {boolean} Whether some place is no file's name.
 */
function writesKind(text: string, part: boolean, grammar: Grammar): boolean {
  const reading = grammar === 'pattern' ? PATTERN : GLOB;
  for (const found of text.matchAll(KIND_WORD)) {
    const before = text.slice(START, found.index);
    const named = NAMED.test(before) || (part && before === '.');
    if (!named || reading.wildcard.test(before.replace(reading.path, '')) || found.groups?.['optional'] !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * Each literal of a module that writes a held kind where its module may not, as `path: text`.
 *
 * @param {string} path - The module's path.
 * @param {string} text - Its text.
 * @returns {readonly string[]} Each such literal.
 */
function kindsWritten(path: string, text: string): readonly string[] {
  const oracle = isTestModule(path);
  return nodes(parse(path, text)).flatMap((node) => {
    const whole = isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node) || isTemplateHead(node);
    const part = isTemplateMiddle(node) || isTemplateTail(node);
    const pattern = isRegularExpressionLiteral(node);
    if (!(whole || part || pattern)) {
      return [];
    }
    const own = pattern ? writesKind(node.text.replaceAll(String.raw`\.`, '.'), part, 'pattern') : writesKind(node.text, part, 'glob');
    const refused = oracle ? (pattern && own) || (whole && KIND_ALONE.test(node.text)) : own;
    return refused ? [`${path}: ${node.text}`] : [];
  });
}

/** The length of `: ` between a found literal's module and its text. */
const SEPARATOR = 2;

/**
 * The modules the scan reads: the harness's (`harnessModules`), the owner and the scan apart.
 *
 * @returns {Promise<readonly string[]>} Their paths.
 */
async function readModules(): Promise<readonly string[]> {
  const held = await population();
  return harnessModules(held).filter((path) => !UNREAD.has(path));
}

/**
 * The literals found, each without its module.
 *
 * @param {readonly string[]} found - Each found literal, as `path: text`.
 * @returns {readonly string[]} Each literal's text.
 */
function strip(found: readonly string[]): readonly string[] {
  return found.map((entry) => entry.slice(entry.indexOf(': ') + SEPARATOR));
}

describe('the held kinds', () => {
  test('are written on their own by no held harness module but their owner', async () => {
    expect.hasAssertions();
    const texts = await textsOf(await readModules());
    expect(RESTATED.unexempted(texts.flatMap(([path, text]: readonly [string, string]) => kindsWritten(path, text)))).toStrictEqual([]);
  });

  test('are composed from the owner', () => {
    expect.hasAssertions();
    expect([typescriptGlob('**/*'), [...TYPESCRIPT]]).toStrictEqual(['**/*.{ts,tsx}', ['.ts', '.tsx']]);
  });
});

describe("the held-kinds scan's reading", () => {
  test('sees the kinds written on their own, in a glob and in a pattern, a file name passing, and a glob passing in a test', () => {
    expect.hasAssertions();
    expect([strip(kindsWritten('a.ts', PLANTED_KINDS)), strip(kindsWritten('a.test.ts', PLANTED_KINDS))]).toStrictEqual([
      [
        '.ts',
        'oxlint:.ts',
        'ts',
        'tsx',
        'src/**/*.{ts,tsx}',
        '**/*.tsx',
        '**/*.test.{ts,tsx,mts}',
        '*.{tsx,ts}',
        '**/*.test.ts',
        'x/*.d.ts',
        '**/*-test.ts',
        '**/?*.test.ts',
        '**/x*.test.ts',
        '**/playwright.*.config.ts',
        'a/[ab].ts',
        String.raw`/\.tsx?$/u`,
        String.raw`/^\.(?:ts|tsx)$/u`,
        String.raw`/\.ts$/u`,
        String.raw`/(?:\.ts)?$/u`,
        String.raw`/x\w*\.test\.ts$/u`,
        String.raw`/(a|b)\.ts$/u`,
        '.*.(test|spec).tsx?$',
      ],
      [
        '.ts',
        'oxlint:.ts',
        'ts',
        'tsx',
        String.raw`/\.tsx?$/u`,
        String.raw`/^\.(?:ts|tsx)$/u`,
        String.raw`/\.ts$/u`,
        String.raw`/(?:\.ts)?$/u`,
        String.raw`/x\w*\.test\.ts$/u`,
        String.raw`/(a|b)\.ts$/u`,
      ],
    ]);
  });
});

/** A folder git ignores, so writing under it changes nothing the gate reads. */
const FOLDER = 'node_modules/.harness-planted';

/** The planted file, under the ignored folder. */
const PLANTED = `${FOLDER}/written.txt`;

describe("the fixers' writer", () => {
  test('writes a file that reads back as written', async () => {
    expect.hasAssertions();
    await mkdir(fromRoot(FOLDER), { recursive: true });
    try {
      await writeText(PLANTED, 'planted\n');
      await expect(textOf(PLANTED)).resolves.toBe('planted\n');
    } finally {
      await rm(fromRoot(FOLDER), { force: true, recursive: true });
    }
  });
});
