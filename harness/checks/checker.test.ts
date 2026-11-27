/**
 * The scan's readers (a path it does not cover is refused, and a missing symbol has no name), the module
 * classifiers; the one statement of whether a declaration is the platform's is held by
 * `checker-platform.test.ts`.
 */

import { ROLE_WORDS, isRole, isTestInfrastructure } from '#lib/roles.ts';
import { describe, expect, test } from 'vitest';
import { inTestInfrastructure, isProduction, qualifiedName, scanOver, sourceOf } from '#lib/checker.ts';
import type { Population } from '#lib/scope.ts';
import type { ScanOpening } from '#lib/checker.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { population } from '#lib/scope.ts';
import { present } from '#lib/present.ts';
import { usePlanted } from '#lib/scan-hooks.ts';

/** A session's projects, by project file: this one holds none. */
const NO_PROJECTS = new Map<string, ReturnType<ScanOpening['open']>>();

/**
 * A scan opening whose session holds no project, recording what it mounted, opened and released.
 *
 * @param {Pick<string[], 'push'>} events - Where each step is recorded, in order.
 * @param {Population} held - The population.
 * @returns {ScanOpening} The opening.
 */
function noProject(events: Readonly<Pick<string[], 'push'>>, held: Population): ScanOpening {
  return {
    mount: () => {
      events.push('mount');
      return {
        serving: <Result>(run: () => Result): Result => run(),
        unmount: (): void => {
          events.push('unmount');
        },
      };
    },
    open: () => {
      events.push('open');
      return NO_PROJECTS.get('planted');
    },
    paths: [],
    population: held,
    release: () => {
      events.push('release');
    },
  };
}

/**
 * The classifiers' population: a member whose role does not ship, and one whose role ships.
 *
 * @returns {Promise<Population>} The planted population.
 */
async function probeAndView(): Promise<Population> {
  const held = await plantedPopulation(
    [],
    [
      ['packages/probe/', 'test-infrastructure'],
      ['packages/view/', 'view'],
    ],
  );
  return held;
}

const scan = usePlanted([['planted/one.ts', 'export const one = 1;\n']], [['planted/', 'foundation']]);

describe('a scan', () => {
  test('refuses a path it does not cover, naming it', () => {
    expect.hasAssertions();
    expect(() => sourceOf(scan(), 'planted/two.ts')).toThrow('the scan does not cover planted/two.ts');
  });

  test('gives a missing symbol no qualified name', () => {
    expect.hasAssertions();
    const [statement] = sourceOf(scan(), 'planted/one.ts').statements;
    const { checker } = scan();
    const symbol = checker.getSymbolAtLocation(present(statement, 'the planted statement'));
    expect(qualifiedName(checker, symbol)).toBeUndefined();
  });

  test('refused for a project the session lacks, releases the project and unmounts its files', async () => {
    expect.hasAssertions();
    const events: string[] = [];
    const held = await population();
    expect(() => scanOver(noProject(events, held))).toThrow('the scan project');
    expect(events).toStrictEqual(['mount', 'open', 'release', 'unmount']);
  });
});

describe('the module classifiers', () => {
  test("read a member's role, not which object the population holds for it", async () => {
    expect.hasAssertions();
    const held = await probeAndView();
    const copied: Population = { ...held, memberOf: (file: string) => structuredClone(held.memberOf(file)) };
    expect(['packages/probe/src/b.ts', 'packages/view/src/v.ts'].map((file) => inTestInfrastructure(copied, file))).toStrictEqual([
      true,
      false,
    ]);
  });

  test("reads a member whose role does not ship as test infrastructure, and its modules, tests, Playwright specs and test support as not production, and a module Playwright does not match and the harness's check support as production", async () => {
    expect.hasAssertions();
    const held = await probeAndView();
    const modules = [
      'packages/probe/src/b.ts',
      'packages/view/src/v.tsx',
      'packages/view/test/v.test.ts',
      'packages/view/src/testing/t.ts',
      'packages/view/src/v.spec.ts',
      'packages/view/src/v.spec.tsx',
      'harness/lib/a.ts',
      'harness/checks/a.ts',
    ];
    expect(modules.map((file) => [inTestInfrastructure(held, file), isProduction(held, file)])).toStrictEqual([
      [true, false],
      [false, true],
      [false, false],
      [false, false],
      [false, false],
      [false, true],
      [false, true],
      [false, true],
    ]);
  });
});

describe('the roles', () => {
  test('read test infrastructure as the roles whose tier does not ship, every role read', () => {
    expect.hasAssertions();
    expect(ROLE_WORDS.filter((word) => isRole(word)).map((role) => [role, isTestInfrastructure(role)])).toStrictEqual([
      ['experience', false],
      ['foundation', false],
      ['system', false],
      ['test-infrastructure', true],
      ['view', false],
    ]);
  });
});

describe('a module below its member', () => {
  test('reads a test directory below the member holding a module, never above it; a file of no member by its whole path', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      [],
      [
        ['packages/testing/kit/', 'foundation'],
        ['tools/test/probe/', 'test-infrastructure'],
      ],
    );
    const modules = [
      'packages/testing/kit/src/a.ts',
      'packages/testing/kit/src/testing/b.ts',
      'packages/testing/kit/test/c.ts',
      'tools/test/probe/src/d.ts',
      'harness/testing/e.ts',
    ];
    expect(modules.map((file) => isProduction(held, file))).toStrictEqual([true, false, false, false, false]);
  });
});
