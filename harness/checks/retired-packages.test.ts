/**
 * No file of the workspace imports a retired package, and no manifest depends on one.
 *
 * Over every listed module, the POC included: an `import`, an `export … from` or an `import()` whose
 * specifier names a retired package, or one of its subpaths, is a finding; so is a retired package
 * among any manifest's dependencies. A specifier held only in a string, as a plant writes one, is no
 * import. A package is retired when the decision that replaced it is accepted.
 */

import { describe, test } from 'vitest';
import { isCallExpression, isExportDeclaration, isImportDeclaration, isStringLiteral } from 'typescript/unstable/ast/is';
import { isLintable, textOf, tracked } from '#lib/source-files.ts';
import { nodes, parse } from '#lib/ts-source.ts';
import { object, parsed } from '#lib/config.ts';
import { Accepted } from '#lint-rules/exemptions.ts';
import type { Node } from '#lib/ts-source.ts';
import { SyntaxKind } from 'typescript/unstable/ast';

const HARNESS_ID = 'retired-packages';

/** The retired packages. `lit`: the view layer is Solid (ADR-0002), and the sandbox's part is Solid. */
const RETIRED = new Accepted(['lit']);

/** The modules the scan reads: the files oxlint lints. */
const MODULE = { test: isLintable };

/** A manifest, at the root or in a package. */
const MANIFEST = /(?:^|\/)package\.json$/u;

/** The fields of a manifest that name dependencies. */
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;

/** A package's name starts a specifier: a scoped name has two segments, any other one. */
const FIRST_SEGMENT = 0;
const SCOPED_SEGMENTS = 2;
const UNSCOPED_SEGMENTS = 1;

/** The quotes a specifier opens with. */
const QUOTES = new Accepted(["'", '"', '`']);

/**
 * The package a bare specifier names; a relative, absolute or subpath-map specifier names none.
 *
 * @param {string} specifier - The specifier as the module writes it.
 * @returns {string | undefined} The package's name.
 */
function packageOf(specifier: string): string | undefined {
  if (/^[./#]/u.test(specifier) || specifier.includes(':')) {
    return undefined;
  }
  return specifier
    .split('/')
    .slice(FIRST_SEGMENT, specifier.startsWith('@') ? SCOPED_SEGMENTS : UNSCOPED_SEGMENTS)
    .join('/');
}

/**
 * The specifier a node imports from, when it is an import, a re-export or a dynamic import.
 *
 * @param {Node} node - The node.
 * @returns {string | undefined} The specifier.
 */
function specifierOf(node: Node): string | undefined {
  if (
    (isImportDeclaration(node) || isExportDeclaration(node)) &&
    node.moduleSpecifier !== undefined &&
    isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  if (isCallExpression(node) && node.expression.kind === SyntaxKind.ImportKeyword) {
    const [first] = node.arguments;
    return first !== undefined && isStringLiteral(first) ? first.text : undefined;
  }
  return undefined;
}

/**
 * The retired packages a module imports, as `path: package`.
 *
 * @param {string} path - The module's path.
 * @param {string} text - Its text.
 * @returns {string[]} Its findings.
 */
function retiredImports(path: string, text: string): string[] {
  // The cheap test before the module is parsed: a retired name opening a quoted string.
  const quoted = [...RETIRED].some((name) => [...QUOTES].some((quote) => text.includes(`${quote}${name}`)));
  if (!quoted) {
    return [];
  }
  return nodes(parse(path, text)).flatMap((node) => {
    const specifier = specifierOf(node);
    const named = specifier === undefined ? undefined : packageOf(specifier);
    return RETIRED.has(named) ? [`${path}: ${String(named)}`] : [];
  });
}

/**
 * The retired packages a manifest depends on, as `path: field.package`.
 *
 * @param {string} path - The manifest's path.
 * @param {string} text - Its text.
 * @returns {string[]} Its findings.
 */
function retiredDependencies(path: string, text: string): string[] {
  const manifest = object(parsed(text, path), path);
  return DEPENDENCY_FIELDS.flatMap((field) =>
    Object.keys(object(Object.hasOwn(manifest, field) ? manifest[field] : {}, `${path} ${field}`))
      .filter((name) => RETIRED.has(name))
      .map((name) => `${path}: ${field}.${name}`),
  );
}

/**
 * The findings over the listed files that match `pattern`.
 *
 * @param {RegExp} pattern - Which listed files to read.
 * @param {Function} scan - The findings of one file.
 * @returns {Promise<string[]>} Every finding.
 */
async function scanned(pattern: Readonly<Pick<RegExp, 'test'>>, scan: (path: string, text: string) => string[]): Promise<string[]> {
  const listed = await tracked();
  const found = await Promise.all(
    listed
      .filter((path) => pattern.test(path))
      .map(async (path) => {
        const text = await textOf(path);
        return scan(path, text);
      }),
  );
  return found.flat();
}

describe('the workspace', () => {
  test('no module imports a retired package', async ({ expect }) => {
    expect.hasAssertions();
    await expect(scanned(MODULE, retiredImports)).resolves.toStrictEqual([]);
  });

  test('no manifest depends on a retired package', async ({ expect }) => {
    expect.hasAssertions();
    await expect(scanned(MANIFEST, retiredDependencies)).resolves.toStrictEqual([]);
  });
});

describe('the retired-package scans', () => {
  test.for([
    ["import { LitElement } from 'lit';\n", 'plant/a.ts: lit'],
    ["export { html } from 'lit/html.js';\n", 'plant/a.ts: lit'],
    ["const lit = await import('lit');\nexport { lit };\n", 'plant/a.ts: lit'],
    ["import type { CSSResult } from 'lit';\n", 'plant/a.ts: lit'],
  ] as const)('sees the planted import in %j', ([text, finding], { expect }) => {
    expect.hasAssertions();
    expect(retiredImports('plant/a.ts', text)).toStrictEqual([finding]);
  });

  test.for([
    'const plant = "import { css } from \'lit\';";\nexport { plant };\n',
    "import { html } from 'lit-html';\nexport { html };\n",
    "import { css } from '#src/lit';\nexport { css };\n",
    "import { css } from './lit';\nexport { css };\n",
    "import { literal } from '@scope/lit';\nexport { literal };\n",
  ])('lets a near miss through: %j', (text, { expect }) => {
    expect.hasAssertions();
    expect(retiredImports('plant/a.ts', text)).toStrictEqual([]);
  });

  test('sees a retired dependency in every dependency field, and lets a near miss through', ({ expect }) => {
    expect.hasAssertions();
    const manifest = {
      dependencies: { lit: '^3.0.0' },
      devDependencies: { 'lit-html': '^3.0.0' },
      optionalDependencies: { lit: '^3.0.0' },
      peerDependencies: { lit: '^3.0.0' },
      scripts: { lit: 'echo' },
    };
    expect(retiredDependencies('plant/package.json', JSON.stringify(manifest))).toStrictEqual([
      'plant/package.json: dependencies.lit',
      'plant/package.json: optionalDependencies.lit',
      'plant/package.json: peerDependencies.lit',
    ]);
  });
});

export { HARNESS_ID };
