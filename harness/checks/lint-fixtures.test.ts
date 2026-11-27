/**
 * The fixtures' planted run: two fixtures planted at one path are refused before any tool runs, and the compile that
 * holds each fixture refuses Solid 1.x's `JSX` import, a declared error the source does not have, and an undeclared one.
 */

import { FixtureError, compileProblems, runFixtures } from '#lib/lint-fixtures.ts';
import { describe, expect, test } from 'vitest';
import type { Fixture } from '#lib/lint-fixtures.ts';
import { Project } from '#lib/tools.ts';
import { compilePlanted } from '#lib/fixture-project.ts';

const FIXTURE = { errors: [], file: 'planted/fire.fixture', kind: 'fire', path: 'src/planted.ts', rule: 'planted', source: '' } as const;

/**
 * A must-stay-clean fixture planted under a view directory, so the view's rules and Solid's JSX apply to it.
 *
 * @param {string} name - Its case name, which names its file and its planted path.
 * @param {readonly string[]} errors - The compiler errors it declares.
 * @param {string} source - Its source.
 * @returns {Fixture} The fixture.
 */
function viewFixture(name: string, errors: readonly string[], source: string): Fixture {
  return {
    errors,
    file: `planted/clean-${name}.fixture`,
    kind: 'clean',
    path: `packages/systems/chat/src/view/planted-${name}.tsx`,
    rule: 'planted',
    source,
  };
}

/** Solid 1.x's `JSX` import: `solid-js` 2.0 exports no `JSX`, which `@solidjs/web` holds (TS2305). */
const SOLID_ONE_JSX = viewFixture('jsx', [], "import type { JSX } from 'solid-js';\n\nexport const planted: JSX.Element = undefined;\n");
/** A fixture that declares TS2322 and compiles. */
const STALE = viewFixture('stale', ['TS2322'], 'export const planted = 1;\n');
/** A fixture that declares nothing and has TS2322. */
const UNDECLARED = viewFixture('undeclared', [], "export const planted: number = 'one';\n");
/** A fixture that declares the TS2322 it has. */
const DECLARED = viewFixture('declared', ['TS2322'], "export const planted: number = 'one';\n");

describe('the fixtures of one run', () => {
  test('refuse two planted at one path, naming it', async () => {
    expect.hasAssertions();
    await expect(runFixtures([FIXTURE, { ...FIXTURE, file: 'planted/clean.fixture', kind: 'clean' }])).rejects.toThrow(
      new FixtureError('two fixtures are planted at src/planted.ts'),
    );
  });
});

describe('the compile of a run', () => {
  test("refuses Solid 1.x's JSX import, a stale declaration and an undeclared error, and passes a declared one", async () => {
    expect.hasAssertions();
    const planted = [SOLID_ONE_JSX, STALE, UNDECLARED, DECLARED];
    const found = await runFixtures(planted);
    expect(compileProblems(planted, found.compiled)).toStrictEqual([
      'planted/clean-jsx.fixture: compiles to TS2305, declares none',
      'planted/clean-stale.fixture: compiles to none, declares TS2322',
      'planted/clean-undeclared.fixture: compiles to TS2322, declares none',
    ]);
  });

  test('refuses an error in no fixture, naming its file', () => {
    expect.hasAssertions();
    expect(compileProblems([STALE], [{ code: 'TS2307', file: 'packages/foundation/src/index.ts' }])).toStrictEqual([
      'planted/clean-stale.fixture: compiles to none, declares TS2322',
      'packages/foundation/src/index.ts: TS2307, in no fixture',
    ]);
  });

  test('reads an error tsc reports on no file, as one in no fixture', async () => {
    expect.hasAssertions();
    const project = await Project.create({ linkModules: false });
    try {
      await expect(compilePlanted(project)).resolves.toStrictEqual([{ code: 'TS5058', file: '' }]);
    } finally {
      await project.remove();
    }
  });
});
