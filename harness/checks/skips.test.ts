/**
 * Every skip in the tests is listed with its reason, so a test cannot stop running unnoticed.
 *
 * The scan reads each held test module's syntax tree, so it sees a skip decided at run time as well
 * as a skip modifier: Vitest's and Playwright's `skip`, `skipIf`, `runIf`, `todo`, `only`, `fails`,
 * `fixme` and `fail` on `test`, `it`, `describe` and `test.describe` (aliased imports included),
 * and a test context's `skip()`. Each site is keyed by `site(path, owner)`, where the owner is the
 * title of the test the skip belongs to, or `<module>`.
 */

import ts from 'typescript';
import { describe, expect, test } from 'vitest';

import { Accepted, Exemptions, site } from '../lib/exemptions.ts';
import { heldFiles } from '../lib/scope.ts';
import { textOf } from '../lib/source-files.ts';
import { chain, importsFrom, nodes, parse } from '../lib/ts-source.ts';

export const HARNESS_ID = 'skips';

/** The tests allowed to skip, keyed by `site(path, owner)`. */
const SKIPS = Exemptions.grouped({});

/** The test functions of the runners, by the name they are exported under. */
const RUNNER_FUNCTIONS = new Accepted(['test', 'it', 'describe', 'suite', 'bench']);
const RUNNERS = new Accepted(['vitest', '@playwright/test']);
const SKIPPING = new Accepted(['skip', 'skipIf', 'runIf', 'todo', 'only', 'fails', 'fixme', 'fail']);

/** The local names that stand for a runner's test functions in one module. */
function runnerNames(file: ts.SourceFile): ReadonlyMap<string, string> {
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

function titleOf(call: ts.CallExpression): string | undefined {
  const [first] = call.arguments;
  return first !== undefined && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
    ? first.text
    : undefined;
}

/** The test context parameters of a test callback: its first parameter, or `skip` destructured from it. */
function contextSkips(call: ts.CallExpression): { readonly context: Set<string>; readonly skip: Set<string> } {
  const context = new Set<string>();
  const skip = new Set<string>();
  for (const argument of call.arguments) {
    if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) {
      const parameter = argument.parameters[0]?.name;
      if (parameter !== undefined && ts.isIdentifier(parameter)) {
        context.add(parameter.text);
      } else if (parameter !== undefined && ts.isObjectBindingPattern(parameter)) {
        for (const element of parameter.elements) {
          const key = element.propertyName ?? element.name;
          if (ts.isIdentifier(key) && key.text === 'skip' && ts.isIdentifier(element.name)) {
            skip.add(element.name.text);
          }
        }
      }
    }
  }
  return { context, skip };
}

/** The skip sites of one test module, as `site(path, owner)`. */
export function skips(path: string, text: string): string[] {
  const file = parse(path, text);
  const names = runnerNames(file);
  const found = new Set<string>();
  const rootOf = (expression: ts.Expression): string | undefined =>
    ts.isCallExpression(expression) ? rootOf(expression.expression) : chain(expression)?.[0];
  const isTestCall = (node: ts.Node): node is ts.CallExpression => {
    if (!ts.isCallExpression(node)) {
      return false;
    }
    const root = rootOf(node.expression);
    return root !== undefined && names.has(root);
  };
  const ownerOf = (node: ts.Node): string => {
    for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
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
    if (ts.isPropertyAccessExpression(node) && SKIPPING.has(node.name.text)) {
      const accessed = chain(node);
      if (accessed !== undefined && names.has(accessed[0] ?? '')) {
        found.add(site(path, ownerOf(node)));
      }
    }
    if (isTestCall(node)) {
      const { context, skip } = contextSkips(node);
      for (const inner of nodes(node)) {
        if (!ts.isCallExpression(inner) || inner === node) {
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
    const found = heldFiles('.test.ts', '.test.tsx', '.spec.ts').flatMap((path) => skips(path, textOf(path)));
    expect(SKIPS.unexempted(found)).toEqual([]);
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
    expect(skips(P, text)).toEqual([site(P, owner)]);
  });

  test.each([
    "import { test } from 'vitest';\ntest('a', () => { const s = 'test.skip'; });",
    "import { test } from 'vitest';\nconst list = { skip: 1 };\ntest('a', () => { list.skip; });",
    "import { test } from 'vitest';\ntest.each([1])('a %s', () => {});",
    "const test = { skip: () => {} };\ntest.skip();",
  ])('lets a near miss through: %j', (text) => {
    expect(skips(P, text)).toEqual([]);
  });

  test('a listed skip passes and a stale one fails', () => {
    const planted = skips(P, "import { test } from 'vitest';\ntest.skip('a', () => {});");
    const listed = new Exemptions({ [site(P, 'a')]: 'planted' });
    expect(listed.unexempted(planted)).toEqual([]);
    expect(() => listed.unexempted([])).toThrow('stale');
  });
});
