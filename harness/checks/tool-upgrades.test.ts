/**
 * Every pinned tool has its upstream repository named, every named repository pins a tool, and no directly declared package is locked at two versions.
 *
 * The pins come from the root `package.json`, the members' dependencies and devDependencies, and `pnpm-lock.yaml`
 * (`harness/lib/pins.ts`). `harness.md`'s table of them is generated
 * (`harness/lib/generated.ts`), so a bump the fix task has not rendered fails the generated-docs check. The split
 * packages are read from the same lockfile, over every importer (`harness/lib/lock-splits.ts`).
 */

import { describe, expect, test } from 'vitest';
import { pinned, pins } from '#lib/pins.ts';
import { ConfigError } from '#lib/config.ts';
import { Exemptions } from '#lint-rules/exemptions.ts';
import { LOCK } from './scope.plants.ts';
import type { Pin } from '#lib/pins.ts';
import { UPSTREAM } from '#lib/upstream.ts';
import { repositoryLockSplits } from '#lib/lock-splits.ts';

const HARNESS_ID = 'tool-upgrades';

/** Pin problems the repository carries while the fix is pending, keyed by the problem. */
const PENDING = new Exemptions({});

/**
 * A pin with no upstream or no version, and an upstream entry that pins nothing.
 *
 * @param {readonly Pin[]} found - The pins the lock holds.
 * @param {ReadonlyMap<string, string>} upstream - Each tool's latest version upstream, by tool.
 * @returns {readonly string[]} A pin with no upstream or no version, and an upstream entry that pins nothing.
 */
function pinProblems(found: readonly Pin[], upstream: ReadonlyMap<string, string>): readonly string[] {
  const problems = found
    .filter((pin) => (upstream.get(pin.tool) ?? '') === '')
    .map((pin) => `${pin.tool}: pinned in ${pin.where.join(', ')}, with no upstream repository named`);
  problems.push(
    ...found.filter((pin) => pin.version === undefined).map((pin) => `${pin.tool}: pinned in ${pin.where.join(', ')}, with no version`),
  );
  const named = new Set(found.map((pin) => pin.tool));
  problems.push(
    ...[...upstream.keys()]
      .toSorted()
      .filter((tool) => !named.has(tool))
      .map((tool) => `${tool}: named upstream, but nothing pins it`),
  );
  return problems;
}

describe('the repository', () => {
  test('every pin has its upstream and every upstream a pin', async () => {
    expect.hasAssertions();
    const problems = pinProblems(await pins(), UPSTREAM);
    expect(PENDING.unexempted(problems)).toStrictEqual([]);
  });

  test('locks no directly declared package at two versions, under any importer', async () => {
    expect.hasAssertions();
    await expect(repositoryLockSplits()).resolves.toStrictEqual([]);
  });
});

describe('the pin reader', () => {
  test('read each importer of the lockfile, strip peer suffixes and skip workspace links', () => {
    expect.hasAssertions();
    const found = pinned(
      [
        {
          dir: '',
          manifest: {
            devDependencies: { '@scope/tool': '^2.0.0', local: 'workspace:*', oxlint: '1.94.0', planted: '^1.0.0', unlocked: '^1' },
            engines: { node: '>=22.18.0' },
          },
        },
        { dir: 'packages/app/', manifest: { dependencies: { solid: '2.0.3' }, devDependencies: { vite: '^8.0.0' } } },
      ],
      LOCK,
    );
    expect(found).toStrictEqual([
      { tool: '@scope/tool', version: '2.1.0', where: ['pnpm-lock.yaml (.)'] },
      { tool: 'node', version: '>=22.18.0', where: ['package.json engines'] },
      { tool: 'oxlint', version: '1.94.0', where: ['pnpm-lock.yaml (.)'] },
      { tool: 'planted', version: '1.0.3', where: ['pnpm-lock.yaml (.)'] },
      { tool: 'pnpm', version: undefined, where: ['package.json packageManager'] },
      { tool: 'solid', version: undefined, where: ['pnpm-lock.yaml (packages/app)'] },
      { tool: 'unlocked', version: undefined, where: ['pnpm-lock.yaml (.)'] },
      { tool: 'vite', version: '8.3.8', where: ['pnpm-lock.yaml (packages/app)'] },
    ]);
  });

  test('read a pinned packageManager and a manifest with no engines, and refuse a dependency that is not a string', () => {
    expect.hasAssertions();
    expect(pinned([{ dir: '', manifest: { packageManager: 'pnpm@10.28.0' } }], LOCK)).toStrictEqual([
      { tool: 'node', version: undefined, where: ['package.json engines'] },
      { tool: 'pnpm', version: '10.28.0', where: ['package.json packageManager'] },
    ]);
    expect(() => pinned([{ dir: '', manifest: { devDependencies: { oxlint: 1 } } }], LOCK)).toThrow(/is not a string/u);
  });
});

describe('the lockfile reader', () => {
  test("read only an importer's dependency groups, and a pin whose entry has no version as one with no version", () => {
    expect.hasAssertions();
    const lockText = [
      'importers:',
      '',
      '  .:',
      '    devDependencies:',
      '      oxlint:',
      '        specifier: 1.94.0',
      '      vite:',
      '        specifier: ^8.0.0',
      '        version: 8.3.8',
      '    dependenciesMeta:',
      '      vite:',
      '        injected: true',
      '    publishDirectory: dist',
      '',
      '  a/empty: {}',
      '',
    ].join('\n');
    const manifest = { devDependencies: { oxlint: '1.94.0', vite: '^8.0.0' } };
    expect([pinned([{ dir: '', manifest }], lockText), pinned([{ dir: 'a/empty/', manifest }], lockText)]).toStrictEqual([
      [
        { tool: 'node', version: undefined, where: ['package.json engines'] },
        { tool: 'oxlint', version: undefined, where: ['pnpm-lock.yaml (.)'] },
        { tool: 'pnpm', version: undefined, where: ['package.json packageManager'] },
        { tool: 'vite', version: '8.3.8', where: ['pnpm-lock.yaml (.)'] },
      ],
      [
        { tool: 'oxlint', version: undefined, where: ['pnpm-lock.yaml (a/empty)'] },
        { tool: 'vite', version: undefined, where: ['pnpm-lock.yaml (a/empty)'] },
      ],
    ]);
  });

  test('refuse a lockfile that is not YAML, naming the lockfile', () => {
    expect.hasAssertions();
    const conflicted = ['importers:', '<<<<<<< ours', '  .: {}', '=======', '  .:', '    dependencies: {}', '>>>>>>> theirs', ''].join(
      '\n',
    );
    expect(() => pinned([{ dir: '', manifest: {} }], conflicted)).toThrow(ConfigError);
    expect(() => pinned([{ dir: '', manifest: {} }], conflicted)).toThrow(/^pnpm-lock\.yaml is not YAML: /u);
  });
});

describe('the lockfile reader over the group pnpm writes a pin in', () => {
  test('read a pin that pnpm records in another dependency group than the manifest lists it in', () => {
    expect.hasAssertions();
    const lockText = [
      'importers:',
      '',
      '  .:',
      '    optionalDependencies:',
      '      is-odd:',
      '        specifier: 3.0.1',
      '        version: 3.0.1',
      '',
    ].join('\n');
    expect(
      pinned([{ dir: '', manifest: { devDependencies: { 'is-odd': '3.0.1' }, optionalDependencies: { 'is-odd': '3.0.1' } } }], lockText),
    ).toStrictEqual([
      { tool: 'is-odd', version: '3.0.1', where: ['pnpm-lock.yaml (.)'] },
      { tool: 'node', version: undefined, where: ['package.json engines'] },
      { tool: 'pnpm', version: undefined, where: ['package.json packageManager'] },
    ]);
  });
});

describe('the lockfile reader over the key forms pnpm writes', () => {
  test('read each importer by the key pnpm writes: quoted, holding a colon, or with no dependencies', () => {
    expect.hasAssertions();
    const lockText = [
      'importers:',
      '',
      "  '@s/p':",
      '    devDependencies:',
      '      oxlint:',
      '        specifier: 1.94.0',
      '        version: 1.94.0',
      '',
      '  a/sp ace: {}',
      '',
      '  a/x:y:',
      '    devDependencies:',
      '      vite:',
      '        specifier: ^8.0.0',
      '        version: 8.3.8',
      '',
    ].join('\n');
    const manifest = { devDependencies: { oxlint: '1.94.0', vite: '^8.0.0' } };
    const dirs = ['@s/p/', 'a/sp ace/', 'a/x:y/'] as const;
    expect(dirs.map((dir) => pinned([{ dir, manifest }], lockText))).toStrictEqual([
      [
        { tool: 'oxlint', version: '1.94.0', where: ['pnpm-lock.yaml (@s/p)'] },
        { tool: 'vite', version: undefined, where: ['pnpm-lock.yaml (@s/p)'] },
      ],
      [
        { tool: 'oxlint', version: undefined, where: ['pnpm-lock.yaml (a/sp ace)'] },
        { tool: 'vite', version: undefined, where: ['pnpm-lock.yaml (a/sp ace)'] },
      ],
      [
        { tool: 'oxlint', version: undefined, where: ['pnpm-lock.yaml (a/x:y)'] },
        { tool: 'vite', version: '8.3.8', where: ['pnpm-lock.yaml (a/x:y)'] },
      ],
    ]);
  });
});

describe('the pin check', () => {
  test('see a new pin without a row, a pin without a version, and a row without a pin', () => {
    expect.hasAssertions();
    const found: readonly Pin[] = [
      { tool: 'node', version: '>=22.18.0', where: ['package.json engines'] },
      { tool: 'planted', version: '1.0.0', where: ['pnpm-lock.yaml (.)'] },
      { tool: 'unlocked', version: undefined, where: ['pnpm-lock.yaml (.)'] },
    ];
    expect(
      pinProblems(
        found,
        new Map([
          ['node', 'nodejs/node'],
          ['unlocked', 'someone/unlocked'],
          ['gone', 'someone/gone'],
        ]),
      ),
    ).toStrictEqual([
      'planted: pinned in pnpm-lock.yaml (.), with no upstream repository named',
      'unlocked: pinned in pnpm-lock.yaml (.), with no version',
      'gone: named upstream, but nothing pins it',
    ]);
  });

  test('let a fully named and pinned set through', () => {
    expect.hasAssertions();
    expect(
      pinProblems([{ tool: 'node', version: '>=22', where: ['package.json engines'] }], new Map([['node', 'nodejs/node']])),
    ).toStrictEqual([]);
  });
});

export { HARNESS_ID, pinProblems };
