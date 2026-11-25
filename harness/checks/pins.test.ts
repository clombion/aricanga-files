/** The pins of a population: which manifests are read, how pins of one tool merge, and how an importer key is read. */

import { describe, expect, test } from 'vitest';
import { lockOf, pinned, pinsOf } from '#lib/pins.ts';
import { plantedPopulation } from '#lib/scan-hooks.ts';
import { reader } from './scope.plants.ts';

const LOCK = `lockfileVersion: '9.0'

importers:

  .:
    devDependencies:
      oxlint:
        specifier: 1.94.0
        version: 1.94.0
      planted:
        specifier: ^1.0.0
        version: 1.0.3(peer@2.0.0)
      '@scope/tool':
        specifier: ^2.0.0
        version: 2.1.0

  packages/app:
    devDependencies:
      vite:
        specifier: ^8.0.0
        version: 8.3.8

packages:

  oxlint@1.94.0:
    resolution: {integrity: sha512-x}
`;

describe('the pins of a population', () => {
  test('read the root and the members, and no other listed manifest', async () => {
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

describe('the pins of one tool', () => {
  test('name every input that pins a tool at one version, a lockfile pin and a package.json field together', () => {
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
  test('keep a tool locked at two versions as two pins, and one locked twice at one version as one', () => {
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

  test('read a tool locked under no importer of its manifest as a pin with no version', () => {
    expect.hasAssertions();
    expect(pinned([{ dir: 'gone/', manifest: { devDependencies: { vite: '^8' } } }], LOCK)).toStrictEqual([
      { tool: 'vite', version: undefined, where: ['pnpm-lock.yaml (gone)'] },
    ]);
  });

  test('read an importer key as the text pnpm wrote, a number-like one included', () => {
    expect.hasAssertions();
    expect([...lockOf(['importers:', '  .: {}', '  1.0: {}', '  0x10: {}', ''].join('\n')).keys()]).toStrictEqual(['.', '1.0', '0x10']);
  });
});

describe('the order of the pins', () => {
  test('order the pins by tool, then version, a name holding a character below the quote included', () => {
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
