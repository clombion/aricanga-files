/**
 * No harness module reads a `package.json` itself but the population's reading of the manifests.
 *
 * The population reads every manifest it holds at one moment (`harness/lib/manifests.ts`, through
 * the reader its inputs name; a planted population hands it a reader of planted texts), and every
 * reader of a manifest's fields reads them from it: `Member.manifest`, `Population.rootManifest`.
 * Over every held `.ts` file under `harness/`, the scan reads the syntax tree for a read of a file
 * whose path names a `package.json`: a call of a reader (`READERS`, the injected `read` of a
 * population's inputs among them) or an import whose argument is a string or template ending in
 * `package.json`, a call of `manifestOf`, or a name bound to one of these, through a variable, a
 * loop over a list, or the parameter of a callback over a list. The population's reading is
 * exempted with the modules that read manifests for another purpose, each with its reason, and each
 * entry fails as stale once its module reads no manifest.
 */

import { Accepted, Exemptions, site } from '#lint-rules/exemptions.ts';
import type { ArrowFunction, CallExpression, FunctionDeclaration, FunctionExpression, Identifier } from 'typescript/unstable/ast';
import { chain, holdsNoRuntimeValue, isPropertyName, nodes, parse } from '#lib/ts-source.ts';
import { describe, test } from 'vitest';
import {
  isArrowFunction,
  isBlock,
  isCallExpression,
  isForOfStatement,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isImportDeclaration,
  isNoSubstitutionTemplateLiteral,
  isPropertyAccessExpression,
  isSourceFile,
  isStringLiteral,
  isTemplateExpression,
  isVariableDeclarationList,
  isVariableStatement,
} from 'typescript/unstable/ast/is';
import type { Node } from '#lib/ts-source.ts';
import { SyntaxKind } from 'typescript/unstable/ast';
import { harnessModules } from '#lib/holders.ts';
import { isEmpty } from '#lib/lists.ts';
import { population } from '#lib/scope.ts';
import { textsOf } from '#lib/source-files.ts';

const HARNESS_ID = 'manifest-reads';

/** The calls that read a file's text: by name or as a method (`project.read`), the injected `read` included. */
const READERS = new Accepted(['read', 'textOf', 'textsOf', 'textAt', 'readFile', 'readFileSync', 'createReadStream']);

/** What the scan names a module's read of a manifest by. */
const READ = 'reads a package.json';

/** The population's reading of the manifests, and the modules that read manifests for another purpose than their fields, each with why. */
const EXEMPT = new Exemptions({
  [site('harness/lib/manifests.ts', READ)]:
    "the population's reading of the manifests: the root's and each member's, at one moment, through the reader its inputs name",
  [site('harness/checks/doc-references.packages.ts', READ)]:
    'reads the name of every tracked manifest, the POC reference included, since a reference may name any package of the checkout',
  [site('harness/checks/harness-paths.test.ts', READ)]:
    "reads harness/lint-rules/package.json's import map, which is no population's manifest: it is held to the harness's directory owners",
  [site('harness/checks/json-files.test.ts', READ)]:
    "parses every held package.json for its dependency groups, harness/lint-rules/package.json included, which is no population's manifest: a package listed twice is a fact of the file",
});

/** A declaration that binds a name, with what it binds the name to when it says. */
type Binding = Readonly<{ name: Node; initializer?: Node | undefined }>;

/** How many names deep the scan follows a binding: a name bound to a name bound to a path. */
const DEPTH = 3;

/** The last part of a template, and one binding fewer to follow. */
const LAST = -1;
const ONE = 1;

/** A manifest's path, as a string or a template's last part ends. */
const MANIFEST = /(?:^|\/)package\.json$/u;

/**
 * Whether a declaration binds a name.
 *
 * @param {Binding} declaration - The declaration.
 * @param {string} name - The name.
 * @returns {boolean} Whether it binds it.
 */
function bindsName(declaration: Binding, name: string): boolean {
  return isIdentifier(declaration.name) && declaration.name.text === name;
}

/**
 * Whether a node is a function whose parameters bind names.
 *
 * @param {Node} node - The node.
 * @returns {boolean} Whether it is a function.
 */
function isFunction(node: Node): node is ArrowFunction | FunctionDeclaration | FunctionExpression {
  return isArrowFunction(node) || isFunctionExpression(node) || isFunctionDeclaration(node);
}

/**
 * What a parameter named `name` of a function stands for: the list a callback is handed over
 * (`list.map((name) => …)`), or nothing the scan can follow.
 *
 * @param {Node} node - A function.
 * @param {string} name - The name.
 * @returns {readonly Node[]} The list, when the function is a callback over one and binds the name.
 */
function parameterBinding(node: Node, name: string): readonly Node[] {
  if (!isFunction(node) || !node.parameters.some((parameter: Binding) => bindsName(parameter, name))) {
    return [];
  }
  const { parent } = node;
  return isCallExpression(parent) && isPropertyAccessExpression(parent.expression) ? [parent.expression.expression] : [node];
}

/**
 * What a block's own declarations bind a name to: each variable's initializer.
 *
 * @param {Node} node - A block or a module.
 * @param {string} name - The name.
 * @returns {readonly Node[]} The initializers.
 */
function declaredBinding(node: Node, name: string): readonly Node[] {
  if (!isBlock(node) && !isSourceFile(node)) {
    return [];
  }
  return node.statements.flatMap((statement) =>
    isVariableStatement(statement)
      ? statement.declarationList.declarations.flatMap((declaration: Binding) =>
          bindsName(declaration, name) && declaration.initializer !== undefined ? [declaration.initializer] : [],
        )
      : [],
  );
}

/**
 * What a loop over a list binds a name to: the list.
 *
 * @param {Node} node - A statement.
 * @param {string} name - The name.
 * @returns {readonly Node[]} The list, when the node is such a loop.
 */
function loopBinding(node: Node, name: string): readonly Node[] {
  if (!isForOfStatement(node) || !isVariableDeclarationList(node.initializer)) {
    return [];
  }
  return node.initializer.declarations.some((declaration: Binding) => bindsName(declaration, name)) ? [node.expression] : [];
}

/**
 * What a name stands for where it is used: the nearest binding of it, walking out from the use.
 *
 * @param {Identifier} use - The name, where it is used.
 * @returns {readonly Node[]} What it is bound to; nothing when no binding is found.
 */
function bindingOf(use: Identifier): readonly Node[] {
  for (let scope: Node = use.parent; ; scope = scope.parent) {
    const bound = [...parameterBinding(scope, use.text), ...declaredBinding(scope, use.text), ...loopBinding(scope, use.text)];
    if (!isEmpty(bound) || isSourceFile(scope)) {
      return bound.filter((node) => !isFunction(node));
    }
  }
}

/**
 * Whether a node, or a name it uses (followed `depth` bindings deep), names a manifest's path.
 *
 * @param {Node} root - The node.
 * @param {number} depth - How many bindings deep to follow names.
 * @returns {boolean} Whether it names one.
 */
function namesManifest(root: Node, depth: number): boolean {
  return nodes(root).some(
    (node) =>
      ((isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) && MANIFEST.test(node.text)) ||
      (isTemplateExpression(node) && MANIFEST.test(node.templateSpans.at(LAST)?.literal.text ?? '')) ||
      (isCallExpression(node) && chain(node.expression)?.at(LAST) === 'manifestOf') ||
      (isIdentifier(node) &&
        depth >= ONE &&
        !isPropertyName(node) &&
        !holdsNoRuntimeValue(node) &&
        bindingOf(node).some((bound) => namesManifest(bound, depth - ONE))),
  );
}

/**
 * Whether a call reads a file: a reader's call, by its name or as a method, or a module's import.
 *
 * @param {CallExpression} call - The call.
 * @returns {boolean} Whether it reads one.
 */
function isRead(call: CallExpression): boolean {
  const callee = call.expression;
  return (
    callee.kind === SyntaxKind.ImportKeyword ||
    (isIdentifier(callee) && READERS.has(callee.text)) ||
    (isPropertyAccessExpression(callee) && READERS.has(callee.name.text))
  );
}

/**
 * The module's reads of a manifest, as `site(path, READ)`: one when it reads any.
 *
 * @param {string} path - The module's path.
 * @param {string} text - Its text.
 * @returns {readonly string[]} Its finding, or none.
 */
function manifestReads(path: string, text: string): readonly string[] {
  const reads = nodes(parse(path, text)).filter(
    (node) =>
      (isCallExpression(node) && isRead(node) && node.arguments.some((argument) => namesManifest(argument, DEPTH))) ||
      (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier) && MANIFEST.test(node.moduleSpecifier.text)),
  );
  return isEmpty(reads) ? [] : [site(path, READ)];
}

/**
 * The harness's modules (`harnessModules`).
 *
 * @returns {Promise<readonly string[]>} Their paths.
 */
async function scannedModules(): Promise<readonly string[]> {
  const held = await population();
  return harnessModules(held);
}

describe('the repository', () => {
  test("reads a package.json only where the population reads the manifests, or for an exemption's reason", async ({ expect }) => {
    expect.hasAssertions();
    const texts = await textsOf(await scannedModules());
    expect(EXEMPT.unexempted(texts.flatMap(([path, text]: readonly [string, string]) => manifestReads(path, text)))).toStrictEqual([]);
  });
});

describe('the scan', () => {
  test.for([
    "const text = await textOf('package.json');",
    ['const text = await textOf(`', '$', '{dir}package.json`);'].join(''),
    'const text = await textOf(`packages/a/package.json`);',
    "const text = await readFile(fromRoot('packages/a/package.json'), 'utf8');",
    'const text = await textOf(manifestOf(dir));',
    "const text = await (await import('./source-files.ts')).textOf('package.json');",
    "const MANIFEST = 'package.json';\nconst text = await textOf(MANIFEST);",
    "const listed = await heldFiles('package.json');\nconst texts = await Promise.all(listed.map(async (path) => textOf(path)));",
    "const texts = await textsOf(listed.filter((path) => path.endsWith('package.json')));",
    "for (const path of await heldFiles('package.json')) {\n  await textOf(path);\n}",
    "import manifest from '../../package.json' with { type: 'json' };",
    "const manifest = await import('../../package.json', { with: { type: 'json' } });",
    "const lockText = await read(LOCKFILE);\nconst again = await read('package.json');",
    "const text = await project.read('packages/a/package.json');",
  ])('sees the planted read: %j', (text, { expect }) => {
    expect.hasAssertions();
    expect(manifestReads('harness/lib/plant.ts', text)).toStrictEqual([site('harness/lib/plant.ts', READ)]);
  });

  test.for([
    "const fields = object(parsed(text, path), 'package.json');",
    "await project.write('package.json', '{}');",
    "const plants = [['node_modules/x/package.json', '{}']];\nconst texts = await textsOf(listed.filter((path) => path.endsWith('.ts')));",
    "const text = await textOf('.node-version');",
    'const lockText = await read(LOCKFILE);',
    "const held = await population();\nconst scripts = held.rootManifest['scripts'];",
    "const options = { path: 'package.json' };\nconst text = await textOf(other.path);",
  ])('lets a near miss through: %j', (text, { expect }) => {
    expect.hasAssertions();
    expect(manifestReads('harness/lib/plant.ts', text)).toStrictEqual([]);
  });
});

export { HARNESS_ID };
