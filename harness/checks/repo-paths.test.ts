/**
 * No harness module but `harness/lib/paths.ts` computes the repository root or a path from its own location.
 *
 * Over every held `.ts` file under `harness/`, the scan reads the syntax tree for the ways a module
 * finds where it lives: `import.meta.url`, `import.meta.dirname`, `import.meta.filename`,
 * `__dirname`, `__filename`, and `fileURLToPath` imported from `node:url`. A module that needs a
 * path asks `paths.ts` (`REPO_ROOT`, `fromRoot`, `relative`).
 */

import { Accepted, site } from '#lint-rules/exemptions.ts';
import { describe, expect, test } from 'vitest';
import { importsFrom, isPropertyName, nodes, parse } from '#lib/ts-source.ts';
import { isIdentifier, isMetaProperty, isPropertyAccessExpression } from 'typescript/unstable/ast/is';
import { textOf, textsOf } from '#lib/source-files.ts';
import type { SourceFile } from '#lib/ts-source.ts';
import { SyntaxKind } from 'typescript/unstable/ast';
import { harnessModules } from '#lib/holders.ts';
import { population } from '#lib/scope.ts';

const HARNESS_ID = 'repo-paths';

/** The one module allowed to compute where the repository is. */
const OWNER = 'harness/lib/paths.ts';
const META = new Accepted(['url', 'dirname', 'filename']);
const GLOBALS = new Accepted(['__dirname', '__filename']);
const URL_MODULES = new Accepted(['node:url', 'url']);

/**
 * The names a module imports from the URL modules.
 *
 * @param {SourceFile} file - The parsed module.
 * @returns {readonly string[]} The imported names.
 */
function urlImports(file: SourceFile): readonly string[] {
  const names: string[] = [];
  for (const module of URL_MODULES) {
    names.push(...importsFrom(file, module).values());
  }
  return names;
}

/**
 * The sites of one module that find its own location, as `site(path, what)`.
 *
 * @param {string} path - The path.
 * @param {string} text - The text.
 * @returns {string[]} The sites of one module that find its own location, as `site(path, what)`.
 */
function locating(path: string, text: string): string[] {
  const file = parse(path, text);
  const found: string[] = urlImports(file)
    .filter((imported) => imported === 'fileURLToPath')
    .map(() => site(path, 'fileURLToPath'));
  for (const node of nodes(file)) {
    if (
      isPropertyAccessExpression(node) &&
      isMetaProperty(node.expression) &&
      node.expression.keywordToken === SyntaxKind.ImportKeyword &&
      META.has(node.name.text)
    ) {
      found.push(site(path, `import.meta.${node.name.text}`));
    } else if (isIdentifier(node) && GLOBALS.has(node.text) && !isPropertyName(node)) {
      found.push(site(path, node.text));
    }
  }
  return found;
}

/**
 * The harness's modules (`harnessModules`) other than the owner.
 *
 * @returns {Promise<readonly string[]>} Their paths.
 */
async function otherHarnessModules(): Promise<readonly string[]> {
  const held = await population();
  return harnessModules(held).filter((path) => path !== OWNER);
}

describe('the repository', () => {
  test('only paths.ts computes where the repository is', async () => {
    expect.hasAssertions();
    const texts = await textsOf(await otherHarnessModules());
    expect(texts.flatMap(([path, text]: readonly [string, string]) => locating(path, text))).toStrictEqual([]);
  });

  test('paths.ts is where the root is computed', async () => {
    expect.hasAssertions();
    const text = await textOf(OWNER);
    expect(locating(OWNER, text)).not.toStrictEqual([]);
  });
});

describe('the scan', () => {
  test.each([
    ['harness/checks/plant.test.ts', 'const here = new URL(import.meta.url);', 'import.meta.url'],
    ['harness/lib/plant.ts', 'const here = import.meta.dirname;', 'import.meta.dirname'],
    ['harness/scripts/plant.ts', 'const here = import.meta.filename;', 'import.meta.filename'],
    ['harness/lib/plant.ts', 'const here = __dirname;', '__dirname'],
    ['harness/scripts/plant.ts', 'export const here = __filename;', '__filename'],
    ['harness/checks/plant.test.ts', "import { fileURLToPath } from 'node:url';", 'fileURLToPath'],
    ['harness/lib/plant.ts', "import { fileURLToPath as toPath } from 'url';", 'fileURLToPath'],
  ])('sees the planted locator in %s: %j', (path, text, what) => {
    expect.hasAssertions();
    expect(locating(path, text)).toStrictEqual([site(path, what)]);
  });

  test.each([
    "import { fromRoot } from './paths.ts';\nconst file = fromRoot('package.json');",
    "const text = 'import.meta.url and __dirname inside a string';",
    'const env = import.meta.env;',
    "import { pathToFileURL } from 'node:url';",
    'const options = { __dirname: 1 }; const value = options.__dirname;',
  ])('lets a near miss through: %j', (text) => {
    expect.hasAssertions();
    expect(locating('harness/lib/plant.ts', text)).toStrictEqual([]);
  });
});

export { HARNESS_ID, locating };
