/**
 * The one statement of whether a declaration is the platform's (`isPlatformDeclaration`, checker.ts): no
 * other module that reads TypeScript's checker or a program (it imports TypeScript's API or checker.ts)
 * names `node_modules`, in a literal of any spelling. Tests are aside: they plant installed packages.
 */

import { describe, test } from 'vitest';
import { isImportDeclaration, isLiteralLikeNode, isStringLiteral } from 'typescript/unstable/ast';
import { nodes, parse } from '#lib/ts-source.ts';
import { harnessModules } from '#lib/holders.ts';
import { isRunnerTest } from '#lib/test-globs.ts';
import { population } from '#lib/scope.ts';
import { textsOf } from '#lib/source-files.ts';

/** The platform's directory, spelt so this module names it in no literal of its own. */
const PLATFORM_DIRECTORY = ['node', 'modules'].join('_');

/** A specifier of TypeScript's API or of checker.ts: what a module that reads the checker or a program imports. */
const CHECKER_READER = /^typescript\/unstable\/|(?:^|\/)checker\.ts$/u;

/**
 * Whether a module reads TypeScript's checker or a program and names the platform's directory in a literal
 * of any spelling (a string, a template, a regular expression).
 *
 * @param {string} path - The module's path.
 * @param {string} text - Its text.
 * @returns {boolean} Whether it does.
 */
function namesThePlatform(path: string, text: string): boolean {
  if (!text.includes(PLATFORM_DIRECTORY)) {
    return false;
  }
  const file = parse(path, text);
  const readsChecker = file.statements.some(
    (statement) =>
      isImportDeclaration(statement) && isStringLiteral(statement.moduleSpecifier) && CHECKER_READER.test(statement.moduleSpecifier.text),
  );
  return readsChecker && nodes(file).some((node) => isLiteralLikeNode(node) && node.text.includes(PLATFORM_DIRECTORY));
}

describe("the platform's declarations", () => {
  test("are told in checker.ts alone: no other module that reads TypeScript's checker, tests aside, names the platform's directory in any spelling", async ({
    expect,
  }) => {
    expect.hasAssertions();
    const texts = await textsOf(harnessModules(await population()).filter((path) => !isRunnerTest(path)));
    const naming = texts.filter(([path, text]) => namesThePlatform(path, text));
    expect(naming.map(([path]) => path)).toStrictEqual(['harness/lib/checker.ts']);
  });
});
