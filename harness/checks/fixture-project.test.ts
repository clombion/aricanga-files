/** The fixtures' planted project: each named member's `.` export mapped by name, and tsc's errors read, a broken run refused. */

import { EXIT_BROKEN, EXIT_CLEAN, EXIT_FINDINGS } from '#lib/exit-status.ts';
import { compileErrorsOf, plantedTsconfig } from '#lib/fixture-project.ts';
import { describe, expect, test } from 'vitest';
import { object, parsed } from '#lib/config.ts';
import { FixtureError } from '#lib/fixture-error.ts';
import { fromRoot } from '#lib/paths.ts';
import { plantedPopulation } from '#lib/planted-population.ts';

/**
 * The `paths` entries of a planted tsconfig that map a planted member.
 *
 * @param {string} tsconfig - The tsconfig's text.
 * @returns {Readonly<Record<string, unknown>>} The entries whose key names a planted member.
 */
function plantedPaths(tsconfig: string): Readonly<Record<string, unknown>> {
  const options = object(object(parsed(tsconfig, 'the tsconfig'), 'the tsconfig')['compilerOptions'], 'its compilerOptions');
  return Object.fromEntries(
    Object.entries(object(options['paths'], 'its paths')).filter(([key]: readonly [string, unknown]) => key.startsWith('@planted/')),
  );
}

describe('the planted tsconfig', () => {
  test("maps each named member's `.` export, written as a path or as the map's `.` entry, and nothing else", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      [],
      [
        ['packages/a/', 'system', { exports: './src/a.ts', name: '@planted/a' }],
        ['packages/b/', 'system', { exports: { '.': './src/b.ts', './testing': './src/t.ts' }, name: '@planted/b' }],
        ['packages/c/', 'system', { exports: { '.': { import: './src/c.ts' } }, name: '@planted/c' }],
        ['packages/d/', 'system', { exports: { './browsers': './d.ts' }, name: '@planted/d' }],
        ['packages/e/', 'system', { name: '@planted/e' }],
      ],
    );
    expect(plantedPaths(plantedTsconfig(held))).toStrictEqual({
      '@planted/a': [fromRoot('packages/a/', './src/a.ts')],
      '@planted/b': [fromRoot('packages/b/', './src/b.ts')],
    });
  });
});

describe("tsc's errors", () => {
  test('read each error line, one on no file with an empty file', () => {
    expect.hasAssertions();
    const stdout = "a.ts(1,2): error TS2322: Type 'string'.\nerror TS5058: The specified path does not exist.\n";
    expect(compileErrorsOf(EXIT_FINDINGS, stdout, '')).toStrictEqual([
      { code: 'TS2322', file: 'a.ts' },
      { code: 'TS5058', file: '' },
    ]);
    expect(compileErrorsOf(EXIT_CLEAN, '', '')).toStrictEqual([]);
  });

  test('refuse a failed run with no error line read, naming what it wrote', () => {
    expect.hasAssertions();
    expect(() => compileErrorsOf(EXIT_BROKEN, 'Aborted', 'core dumped')).toThrow(
      new FixtureError('tsc exited 2 with no error read: Abortedcore dumped'),
    );
  });
});
