/** The pins of a population: which manifests are read, how pins of one tool merge, and how an importer key is read. */

import { LOCK, reader } from './scope.plants.ts';
import { describe, test } from 'vitest';
import { lockOf, pinned, pinsOf } from '#lib/pins.ts';
import { ConfigError } from '#lib/config.ts';
import { plantedPopulation } from '#lib/planted-population.ts';

/** A lockfile locking `vite` at an empty version. */
const EMPTY_VERSION = ['importers:', '  .:', '    devDependencies:', "      vite: {specifier: '8', version: ''}", ''].join('\n');

/**
 * The pins of a root whose lockfile locks a tool at an empty version.
 *
 * @returns {readonly unknown[]} The pins, if not refused.
 */
function emptyInLock(): readonly unknown[] {
  return pinned([{ dir: '', manifest: { devDependencies: { vite: '8' } } }], EMPTY_VERSION);
}

/**
 * The pins of a root whose `packageManager` names no version.
 *
 * @returns {readonly unknown[]} The pins, if not refused.
 */
function emptyInField(): readonly unknown[] {
  return pinned([{ dir: '', manifest: { packageManager: 'pnpm@' } }], LOCK);
}

/**
 * The refusal a pinning throws, as text.
 *
 * @param {() => unknown} pinning - The pinning.
 * @returns {string} Its refusal.
 */
function refusal(pinning: () => unknown): string {
  try {
    pinning();
  } catch (error: unknown) {
    return String(error);
  }
  return 'not refused';
}

describe('the pins of a population', () => {
  test('read the root and the members, and no other listed manifest', async ({ expect }) => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      ['harness/lint-rules/package.json'],
      [['packages/app/', 'view', { devDependencies: { vite: '^8.0.0' } }]],
      { devDependencies: { oxlint: '1.94.0' }, engines: { node: '>=22.18.0' }, packageManager: 'pnpm@10.28.0' },
    );
    await expect(pinsOf(held, reader({ 'pnpm-lock.yaml': LOCK }))).resolves.toStrictEqual([
      { tool: 'node', version: '>=22.18.0', where: ['package.json engines'] },
      { tool: 'oxlint', version: '1.94.0', where: ['pnpm-lock.yaml (.)'] },
      { tool: 'pnpm', version: '10.28.0', where: ['package.json packageManager'] },
      { tool: 'vite', version: '8.3.8', where: ['pnpm-lock.yaml (packages/app)'] },
    ]);
  });
});

describe("the pins of a member's manifest", () => {
  test('read its dependencies as well as its devDependencies', async ({ expect }) => {
    expect.hasAssertions();
    const held = await plantedPopulation([], [['packages/app/', 'view', { dependencies: { vite: '^8.0.0' } }]], {});
    await expect(pinsOf(held, reader({ 'pnpm-lock.yaml': LOCK }))).resolves.toStrictEqual([
      { tool: 'node', version: undefined, where: ['package.json engines'] },
      { tool: 'pnpm', version: undefined, where: ['package.json packageManager'] },
      { tool: 'vite', version: '8.3.8', where: ['pnpm-lock.yaml (packages/app)'] },
    ]);
  });
});

describe('the pins of one tool', () => {
  test('name every input that pins a tool at one version, a lockfile pin and a package.json field together', ({ expect }) => {
    expect.hasAssertions();
    const lockText = ['importers:', '  .:', '    devDependencies:', '      pnpm: {specifier: 10.28.0, version: 10.28.0}', ''].join('\n');
    const root = { devDependencies: { pnpm: '10.28.0' }, engines: { node: '>=22' }, packageManager: 'pnpm@10.28.0' };
    expect(pinned([{ dir: '', manifest: root }], lockText).map((pin) => [pin.tool, pin.where])).toStrictEqual([
      ['node', ['package.json engines']],
      ['pnpm', ['package.json packageManager', 'pnpm-lock.yaml (.)']],
    ]);
  });
});

describe('the pins of one tool across inputs', () => {
  test('keep a tool locked at two versions as two pins, and one locked twice at one version as one', ({ expect }) => {
    expect.hasAssertions();
    const lockText = [
      'importers:',
      '  a:',
      '    devDependencies:',
      '      vite: {specifier: ^8, version: 8.3.8}',
      '      oxlint: {specifier: 1, version: 1.94.0}',
      '  b:',
      '    devDependencies:',
      '      vite: {specifier: ^9, version: 9.0.0}',
      '      oxlint: {specifier: 1, version: 1.94.0}',
      '',
    ].join('\n');
    const declared = { devDependencies: { oxlint: '1', vite: '^8' } };
    expect(
      pinned(
        [
          { dir: 'a/', manifest: declared },
          { dir: 'b/', manifest: declared },
        ],
        lockText,
      ),
    ).toStrictEqual([
      { tool: 'oxlint', version: '1.94.0', where: ['pnpm-lock.yaml (a, b)'] },
      { tool: 'vite', version: '8.3.8', where: ['pnpm-lock.yaml (a)'] },
      { tool: 'vite', version: '9.0.0', where: ['pnpm-lock.yaml (b)'] },
    ]);
  });

  test('read a tool locked under no importer of its manifest as a pin with no version', ({ expect }) => {
    expect.hasAssertions();
    expect(pinned([{ dir: 'gone/', manifest: { devDependencies: { vite: '^8' } } }], LOCK)).toStrictEqual([
      { tool: 'vite', version: undefined, where: ['pnpm-lock.yaml (gone)'] },
    ]);
  });

  test('read an importer key as the text pnpm wrote, a number-like one included', ({ expect }) => {
    expect.hasAssertions();
    expect([...lockOf(['importers:', '  .: {}', '  1.0: {}', '  0x10: {}', ''].join('\n')).keys()]).toStrictEqual(['.', '1.0', '0x10']);
  });
});

describe('the empty versions a pin reads', () => {
  test('refuse an empty version, from the lockfile and from packageManager, naming where it is written', ({ expect }) => {
    expect.hasAssertions();
    expect([refusal(emptyInLock), refusal(emptyInField)]).toStrictEqual([
      'ConfigError: pnpm-lock.yaml . devDependencies vite is an empty version',
      'ConfigError: package.json packageManager is an empty version',
    ]);
  });

  test('refuse a version that is no string, and an empty Node floor, naming where each is written', ({ expect }) => {
    expect.hasAssertions();
    const mapped = ['importers:', '  .:', '    devDependencies:', "      vite: {specifier: '8', version: {a: b}}", ''].join('\n');
    expect([
      refusal(() => pinned([{ dir: '', manifest: { devDependencies: { vite: '8' } } }], mapped)),
      refusal(() => pinned([{ dir: '', manifest: { packageManager: 10 } }], LOCK)),
      refusal(() => pinned([{ dir: '', manifest: { engines: { node: '' } } }], LOCK)),
    ]).toStrictEqual([
      'ConfigError: pnpm-lock.yaml . devDependencies vite is not a string: {"a":"b"}',
      'ConfigError: package.json packageManager is not a string: 10',
      'ConfigError: package.json engines.node is an empty version',
    ]);
  });

  test('refuse a lockfile with no importers', ({ expect }) => {
    expect.hasAssertions();
    expect(() => pinned([{ dir: '', manifest: {} }], "lockfileVersion: '9.0'\n")).toThrow(
      new ConfigError('pnpm-lock.yaml importers is not an object: undefined'),
    );
  });
});

describe('the grouping of pins', () => {
  test('give the same pins whatever order the manifests come in, a version and none kept apart', ({ expect }) => {
    expect.hasAssertions();
    const manifests = [
      { dir: 'packages/app/', manifest: { devDependencies: { vite: '^8.0.0' } } },
      { dir: 'gone/', manifest: { devDependencies: { vite: '^8.0.0' } } },
    ] as const;
    const expected = [
      { tool: 'vite', version: undefined, where: ['pnpm-lock.yaml (gone)'] },
      { tool: 'vite', version: '8.3.8', where: ['pnpm-lock.yaml (packages/app)'] },
    ];
    expect([pinned(manifests, LOCK), pinned(manifests.toReversed(), LOCK)]).toStrictEqual([expected, expected]);
  });

  test("name a version's importers by code unit, whatever order the members come in", ({ expect }) => {
    expect.hasAssertions();
    const lockText = [
      'importers:',
      '  a:',
      '    devDependencies:',
      '      vite: {specifier: 8, version: 8.3.8}',
      '  a-b:',
      '    devDependencies:',
      '      vite: {specifier: 8, version: 8.3.8}',
      '',
    ].join('\n');
    const manifest = { devDependencies: { vite: '8' } };
    expect(
      pinned(
        [
          { dir: 'a-b/', manifest },
          { dir: 'a/', manifest },
        ],
        lockText,
      ),
    ).toStrictEqual([{ tool: 'vite', version: '8.3.8', where: ['pnpm-lock.yaml (a, a-b)'] }]);
  });
});

describe('the order of the pins', () => {
  test('order the pins by tool, then version, a name holding a character below the quote included', ({ expect }) => {
    expect.hasAssertions();
    const lockText = [
      'importers:',
      '  .:',
      '    devDependencies:',
      "      'ab!': {specifier: '1', version: 1.0.0}",
      '      ab: {specifier: 1, version: 2.0.0}',
      '',
    ].join('\n');
    const tools = pinned([{ dir: '', manifest: { devDependencies: { ab: '1', 'ab!': '1' } } }], lockText).map((pin) => pin.tool);
    expect(tools).toStrictEqual(['ab', 'ab!', 'node', 'pnpm']);
  });
});
