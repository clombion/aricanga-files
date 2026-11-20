/**
 * Every skip in the tests is listed with its reason, so a test cannot stop running unnoticed.
 *
 * The scan reads each held test module's syntax tree, so it sees a skip decided at run time as well
 * as a skip modifier: Vitest's and Playwright's `skip`, `skipIf`, `runIf`, `todo`, `only`, `fails`,
 * `fixme` and `fail` on `test`, `it`, `describe` and `test.describe` (aliased imports included),
 * and a test context's `skip()`. Each site is keyed by `site(path, owner)`, where the owner is the
 * title of the test the skip belongs to, or `<module>`.
 */

import { Accepted, Exemptions, site } from '#lib/exemptions.ts';
import type { CallExpression, Expression, Node, SourceFile } from 'typescript/unstable/ast';
import { chain, importsFrom, nodes, parse } from '#lib/ts-source.ts';
import { describe, expect, test } from 'vitest';
import { isArrowFunction, isCallExpression, isFunctionExpression, isIdentifier, isNoSubstitutionTemplateLiteral, isObjectBindingPattern, isPropertyAccessExpression, isStringLiteral } from 'typescript/unstable/ast/is';
import { heldFiles } from '#lib/scope.ts';
import { textOf } from '#lib/source-files.ts';

const HARNESS_ID = 'skips';

/** The tests allowed to skip, keyed by `site(path, owner)`. */
const SKIPS = Exemptions.grouped({});

/** The test functions of the runners, by the name they are exported under. */
const RUNNER_FUNCTIONS = new Accepted(['test', 'it', 'describe', 'suite', 'bench']);
const RUNNERS = new Accepted(['vitest', '@playwright/test']);
const SKIPPING = new Accepted(['skip', 'skipIf', 'runIf', 'todo', 'only', 'fails', 'fixme', 'fail']);

/**
 * The local names that stand for a runner's test functions in one module.
 *
 * @param {SourceFile} file - The file.
 * @returns {ReadonlyMap<string, string>} The local names that stand for a runner's test functions in one module.
 */
function runnerNames(file: SourceFile): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const runner of RUNNERS) {
    for (const [local, imported] of importsFrom(file, runner)) {
      if (RUNNER_FUNCTIONS.has(imported)) {
        names.set(local, imported);
      }
    }
  }
  return names;
}

function titleOf(call: CallExpression): string | undefined {
  const [first] = call.arguments;
  return first !== undefined && (isStringLiteral(first) || isNoSubstitutionTemplateLiteral(first))
    ? first.text
    : undefined;
}

/**
 * The test context parameters of a test callback: its first parameter, or `skip` destructured from it.
 *
 * @param {CallExpression} call - A test call expression.
 * @returns {{ readonly context: Set<string>; readonly skip: Set<string> }} The test context parameters of a test callback: its first parameter, or `skip` destructured from it.
 */
function contextSkips(call: CallExpression): { readonly context: Set<string>; readonly skip: Set<string> } {
  const context = new Set<string>();
  const skip = new Set<string>();
  for (const argument of call.arguments) {
    if (isArrowFunction(argument) || isFunctionExpression(argument)) {
      const parameter = argument.parameters[0]?.name;
      if (parameter !== undefined && isIdentifier(parameter)) {
        context.add(parameter.text);
      } else if (parameter !== undefined && isObjectBindingPattern(parameter)) {
        for (const element of parameter.elements) {
          const key = element.propertyName ?? element.name;
          if (key !== undefined && element.name !== undefined && isIdentifier(key) && key.text === 'skip' && isIdentifier(element.name)) {
            skip.add(element.name.text);
          }
        }
      }
    }
  }
  return { context, skip };
}

/**
 * The skip sites of one test module, as `site(path, owner)`.
 *
 * @param {string} path - The path.
 * @param {string} text - The text.
 * @returns {string[]} The skip sites of one test module, as `site(path, owner)`.
 */
function skips(path: string, text: string): string[] {
  const file = parse(path, text);
  const names = runnerNames(file);
  const found = new Set<string>();
  const rootOf = (expression: Expression): string | undefined =>
    isCallExpression(expression) ? rootOf(expression.expression) : chain(expression)?.[0];
  const isTestCall = (node: Node): node is CallExpression => {
    if (!isCallExpression(node)) {
      return false;
    }
    const root = rootOf(node.expression);
    return root !== undefined && names.has(root);
  };
  const ownerOf = (node: Node): string => {
    for (let current: Node | undefined = node; current !== undefined; current = current.parent) {
      if (isTestCall(current)) {
        const title = titleOf(current);
        if (title !== undefined) {
          return title;
        }
      }
    }
    return '<module>';
  };
  for (const node of nodes(file)) {
    if (isPropertyAccessExpression(node) && SKIPPING.has(node.name.text)) {
      const accessed = chain(node);
      if (accessed !== undefined && names.has(accessed[0] ?? '')) {
        found.add(site(path, ownerOf(node)));
      }
    }
    if (isTestCall(node)) {
      const { context, skip } = contextSkips(node);
      for (const inner of nodes(node)) {
        if (!isCallExpression(inner) || inner === node) {
          continue;
        }
        const called = chain(inner.expression);
        const viaContext = called?.length === 2 && context.has(called[0] ?? '') && called[1] === 'skip';
        const viaBinding = called?.length === 1 && skip.has(called[0] ?? '');
        if (viaContext || viaBinding) {
          found.add(site(path, titleOf(node) ?? ownerOf(node)));
        }
      }
    }
  }
  return [...found].toSorted();
}

describe('the repository', () => {
  test('every skip is listed', () => {
    expect.hasAssertions();
    const found = heldFiles('.test.ts', '.test.tsx', '.spec.ts').flatMap((path) => skips(path, textOf(path)));
    expect(SKIPS.unexempted(found)).toStrictEqual([]);
  });
});

describe('the scan', () => {
  const P = 'packages/plant/a.test.ts';

  test.each([
    ["import { test } from 'vitest';\ntest.skip('a', () => {});", 'a'],
    ["import { it } from 'vitest';\nit.todo('a');", 'a'],
    ["import { test } from 'vitest';\ntest.only('a', () => {});", 'a'],
    ["import { test } from 'vitest';\ntest.fails('a', () => {});", 'a'],
    ["import { test } from 'vitest';\ntest.skipIf(process.platform === 'win32')('a', () => {});", 'a'],
    ["import { describe, test } from 'vitest';\ndescribe('group', () => { test.runIf(false)('a', () => {}); });", 'a'],
    ["import { describe } from 'vitest';\ndescribe.skip('group', () => {});", 'group'],
    ["import { test as check } from 'vitest';\ncheck.skip('a', () => {});", 'a'],
    ["import { test } from 'vitest';\ntest('a', (context) => { context.skip(); });", 'a'],
    ["import { test } from 'vitest';\ntest('a', ({ skip }) => { skip(); });", 'a'],
    ["import { test } from '@playwright/test';\ntest('a', () => { test.skip(); });", 'a'],
    ["import { test } from '@playwright/test';\ntest.fixme('a', async () => {});", 'a'],
    ["import { test } from '@playwright/test';\ntest.describe.skip('group', () => {});", 'group'],
    ["import { test } from '@playwright/test';\ntest('a', () => { test.fail(); });", 'a'],
  ])('sees the planted skip in %j', (text, owner) => {
    expect.hasAssertions();
    expect(skips(P, text)).toStrictEqual([site(P, owner)]);
  });

  test.each([
    "import { test } from 'vitest';\ntest('a', () => { const s = 'test.skip'; });",
    "import { test } from 'vitest';\nconst list = { skip: 1 };\ntest('a', () => { list.skip; });",
    "import { test } from 'vitest';\ntest.each([1])('a %s', () => {});",
    "const test = { skip: () => {} };\ntest.skip();",
  ])('lets a near miss through: %j', (text) => {
    expect.hasAssertions();
    expect(skips(P, text)).toStrictEqual([]);
  });

  test('a listed skip passes and a stale one fails', () => {
    expect.hasAssertions();
    const planted = skips(P, "import { test } from 'vitest';\ntest.skip('a', () => {});");
    const listed = new Exemptions({ [site(P, 'a')]: 'planted' });
    expect(listed.unexempted(planted)).toStrictEqual([]);
    expect(() => listed.unexempted([])).toThrow('stale');
  });
});

export { HARNESS_ID, skips };
