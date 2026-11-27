/**
 * Every harness path in harness code is composed from its directory's one owner.
 *
 * The harness's directories are spelled by their owners (`HARNESS_DIRECTORIES` in `test-globs.ts`).
 * Over the harness's modules but the owner's and the harness's tests and their support (whose
 * literals are their own expected values and planted paths), the scan refuses a string, or any part
 * of a template, that spells a harness directory where a path segment starts, anywhere in it (a
 * path, `./` or not, a glob, a message, a `RegExp`'s source), and a regular expression whose source
 * spells one: every harness path is composed from its owner, and a root module imports through the
 * harness's package imports (`#lib/*`). The import maps, which JSON states, are
 * held to the owners: the root manifest maps `#<directory>/*` to each directory and maps nothing
 * else under the harness, and the lint-rules package maps its own key to itself.
 */

import { HARNESS_CHECKS, HARNESS_DIRECTORIES, HARNESS_LIB, HARNESS_LINT_RULES } from '#lib/test-globs.ts';
import { describe, expect, test } from 'vitest';
import {
  isNoSubstitutionTemplateLiteral,
  isRegularExpressionLiteral,
  isStringLiteral,
  isTemplateHead,
  isTemplateMiddle,
  isTemplateTail,
} from 'typescript/unstable/ast/is';
import { nodes, parse } from '#lib/ts-source.ts';
import { object, parsed } from '#lib/config.ts';
import { textOf, textsOf } from '#lib/source-files.ts';
import { basename } from 'node:path/posix';
import { harnessModules } from '#lib/holders.ts';
import { population } from '#lib/scope.ts';
import { site } from '#lint-rules/exemptions.ts';

const HARNESS_ID = 'harness-paths';

/** The module that owns the harness's directories. */
const DIRECTORY_OWNER = `${HARNESS_LIB}test-globs.ts`;

/** A regular expression's escaped slash, read as the slash it matches. */
const ESCAPED_SLASH = /\\\//gu;

/** A directory's closing `/`. */
const CLOSING_SLASH = /\/$/u;

/** The harness's directories, each without its closing `/`. */
const NAMES: readonly string[] = [...HARNESS_DIRECTORIES].map((directory) => directory.replace(CLOSING_SLASH, ''));

/** A harness directory as a string spells it: where a path segment starts, followed by its `/` or the string's end. */
const SPELLING = new RegExp(String.raw`(?<![\w.-])(?:${NAMES.join('|')})(?:/|$)`, 'u');

/**
 * Whether a string spells a harness directory anywhere in it.
 *
 * @param {string} text - The string's text.
 * @returns {boolean} Whether it does.
 */
function spellsInText(text: string): boolean {
  return SPELLING.test(text);
}

/**
 * Whether a regular expression's source spells a harness directory.
 *
 * @param {string} source - The literal's text.
 * @returns {boolean} Whether it does.
 */
function spellsDirectory(source: string): boolean {
  const unescaped = source.replaceAll(ESCAPED_SLASH, '/');
  return [...HARNESS_DIRECTORIES].some((directory) => unescaped.includes(directory));
}

/**
 * The harness paths a module spells instead of composing them from their owner, as `site(path, text)`.
 *
 * @param {string} path - The module's path.
 * @param {string} text - Its text.
 * @returns {readonly string[]} The spellings.
 */
function spelledPaths(path: string, text: string): readonly string[] {
  const file = parse(path, text);
  const found: string[] = [];
  for (const node of nodes(file)) {
    const literal =
      isStringLiteral(node) ||
      isNoSubstitutionTemplateLiteral(node) ||
      isTemplateHead(node) ||
      isTemplateMiddle(node) ||
      isTemplateTail(node);
    if ((literal && spellsInText(node.text)) || (isRegularExpressionLiteral(node) && spellsDirectory(node.text))) {
      found.push(site(path, node.getText(file)));
    }
  }
  return found;
}

/**
 * The harness's modules the path scan reads: all but the owner's and the harness's test project's.
 *
 * @returns {Promise<readonly string[]>} Their paths.
 */
async function composingModules(): Promise<readonly string[]> {
  const held = await population();
  return harnessModules(held).filter((path) => path !== DIRECTORY_OWNER && !path.startsWith(HARNESS_CHECKS));
}

/**
 * The import map's key of a harness directory: `#` and its last segment.
 *
 * @param {string} directory - The directory, with its closing `/`.
 * @returns {string} The key, `#<name>/*`.
 */
function importKey(directory: string): string {
  return `#${basename(directory)}/*`;
}

/**
 * The root manifest's import map of the harness's directories: every entry but the root modules'.
 *
 * @returns {Promise<Readonly<Record<string, unknown>>>} The entries.
 */
async function rootDirectoryMap(): Promise<Readonly<Record<string, unknown>>> {
  const held = await population();
  const imports = object(held.rootManifest['imports'], 'imports');
  return Object.fromEntries(Object.entries(imports).filter(([key]: readonly [string, unknown]) => !key.startsWith('#root/')));
}

describe('the repository', () => {
  test('every harness path is composed from its owner', async () => {
    expect.hasAssertions();
    const texts = await textsOf(await composingModules());
    expect(texts.flatMap(([path, text]: readonly [string, string]) => spelledPaths(path, text))).toStrictEqual([]);
  });

  test("the import maps name each harness directory as its owner spells it, the lint-rules package's its own", async () => {
    expect.hasAssertions();
    const [rootMap, text] = await Promise.all([rootDirectoryMap(), textOf(`${HARNESS_LINT_RULES}package.json`)]);
    const ownMap = object(object(parsed(text, 'manifest'), 'manifest')['imports'], 'imports');
    const expected = Object.fromEntries([...HARNESS_DIRECTORIES].map((directory) => [importKey(directory), `./${directory}*`]));
    expect([rootMap, ownMap]).toStrictEqual([expected, { [importKey(HARNESS_LINT_RULES)]: './*' }]);
  });
});

describe('the path scan', () => {
  test.each([
    ['harness/lib/plant.ts', "const owner = 'harness/lib/process.ts';", "'harness/lib/process.ts'"],
    ['harness/lib/plant.ts', ['const owner = `harness/scripts/', '$', '{name}.ts`;'].join(''), ['`harness/scripts/', '$', '{'].join('')],
    ['knip.config.ts', "import { x } from './harness/lib/x.ts';", "'./harness/lib/x.ts'"],
    ['harness/lib/plant.ts', "const copies = ['harness/lint-rules'];", "'harness/lint-rules'"],
    ['harness/lib/plant.ts', String.raw`const name = /^harness\/checks\/(?<id>\w+)$/u;`, String.raw`/^harness\/checks\/(?<id>\w+)$/u`],
    ['harness/lib/plant.ts', "const message = 'see harness/lib/roles.ts';", "'see harness/lib/roles.ts'"],
    ['harness/lib/plant.ts', "const pattern = new RegExp('^harness/lib/', 'u');", "'^harness/lib/'"],
    ['harness/lib/plant.ts', "const glob = '**/harness/lib/**';", "'**/harness/lib/**'"],
    ['harness/lib/plant.ts', ['const path = `', '$', '{root}/harness/scripts/a.ts`;'].join(''), '}/harness/scripts/a.ts`'],
  ])('sees the spelled path in %s: %j', (path, text, what) => {
    expect.hasAssertions();
    expect(spelledPaths(path, text)).toStrictEqual([site(path, what)]);
  });

  test.each([
    ['const owner = `', '$', '{HARNESS_LIB}process.ts`;'].join(''),
    "const message = 'see the harness lib';",
    "const other = 'myharness/lib/x.ts';",
    "import { x } from '#lib/x.ts';",
    "const root = 'harness/';",
    "const other = 'harness/libs/x.ts';",
  ])('lets a near miss through: %j', (text) => {
    expect.hasAssertions();
    expect(spelledPaths('harness/lib/plant.ts', text)).toStrictEqual([]);
  });
});

export { HARNESS_ID, spelledPaths };
