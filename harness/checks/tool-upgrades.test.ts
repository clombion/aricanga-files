/**
 * Every pinned tool has its upstream repository named, and every named repository pins a tool.
 *
 * The pins come from the root `package.json`, the held workspace packages' devDependencies and
 * `pnpm-lock.yaml` (`harness/lib/pins.ts`). `harness.md`'s table of them is generated
 * (`harness/lib/generated.ts`), so a bump the fix task has not rendered fails the generated-docs check.
 */

import { describe, expect, test } from 'vitest';

import { Exemptions } from '../lib/exemptions.ts';
import { pinned, pins, UPSTREAM } from '../lib/pins.ts';
import type { Pin } from '../lib/pins.ts';

export const HARNESS_ID = 'tool-upgrades';

/** Pin problems the repository carries while the fix is pending, keyed by the problem. */
const PENDING = new Exemptions({
  'pnpm: pinned in package.json packageManager, with no version':
    'adopting: add "packageManager": "pnpm@10.28.0" to package.json, so the pnpm the gate runs is pinned',
});

/** A pin with no upstream or no version, and an upstream entry that pins nothing. */
export function pinProblems(found: readonly Pin[], upstream: ReadonlyMap<string, string>): readonly string[] {
  const problems = found
    .filter((pin) => (upstream.get(pin.tool) ?? '') === '')
    .map((pin) => `${pin.tool}: pinned in ${pin.where}, with no upstream repository named`);
  problems.push(...found.filter((pin) => pin.version === '').map((pin) => `${pin.tool}: pinned in ${pin.where}, with no version`));
  const named = new Set(found.map((pin) => pin.tool));
  problems.push(
    ...[...upstream.keys()]
      .toSorted()
      .filter((tool) => !named.has(tool))
      .map((tool) => `${tool}: named upstream, but nothing pins it`),
  );
  return problems;
}

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

describe('the repository', () => {
  test('every pin has its upstream and every upstream a pin', () => {
    expect(PENDING.unexempted(pinProblems(pins(), UPSTREAM))).toEqual([]);
  });
});

describe('the pin reader and the pin check', () => {
  test('read each importer of the lockfile, strip peer suffixes and skip workspace links', () => {
    const found = pinned(
      [
        {
          importer: '.',
          manifest: {
            devDependencies: { '@scope/tool': '^2.0.0', local: 'workspace:*', oxlint: '1.94.0', planted: '^1.0.0', unlocked: '^1' },
            engines: { node: '>=22.18.0' },
          },
        },
        { importer: 'packages/app', manifest: { dependencies: { solid: '2.0.3' }, devDependencies: { vite: '^8.0.0' } } },
      ],
      LOCK,
    );
    expect(found).toEqual([
      { tool: '@scope/tool', version: '2.1.0', where: 'pnpm-lock.yaml' },
      { tool: 'node', version: '>=22.18.0', where: 'package.json engines' },
      { tool: 'oxlint', version: '1.94.0', where: 'pnpm-lock.yaml' },
      { tool: 'planted', version: '1.0.3', where: 'pnpm-lock.yaml' },
      { tool: 'pnpm', version: '', where: 'package.json packageManager' },
      { tool: 'unlocked', version: '', where: 'pnpm-lock.yaml' },
      { tool: 'vite', version: '8.3.8', where: 'pnpm-lock.yaml' },
    ]);
  });

  test('read a pinned packageManager and a manifest with no engines, and refuse a dependency that is not a string', () => {
    expect(pinned([{ importer: '.', manifest: { packageManager: 'pnpm@10.28.0' } }], LOCK)).toEqual([
      { tool: 'node', version: '', where: 'package.json engines' },
      { tool: 'pnpm', version: '10.28.0', where: 'package.json packageManager' },
    ]);
    expect(() => pinned([{ importer: '.', manifest: { devDependencies: { oxlint: 1 } } }], LOCK)).toThrow(/is not a string/);
  });

  test('see a new pin without a row, a pin without a version, and a row without a pin', () => {
    const found: readonly Pin[] = [
      { tool: 'node', version: '>=22.18.0', where: 'package.json engines' },
      { tool: 'planted', version: '1.0.0', where: 'pnpm-lock.yaml' },
      { tool: 'unlocked', version: '', where: 'pnpm-lock.yaml' },
    ];
    expect(pinProblems(found, new Map([['node', 'nodejs/node'], ['unlocked', 'someone/unlocked'], ['gone', 'someone/gone']]))).toEqual([
      'planted: pinned in pnpm-lock.yaml, with no upstream repository named',
      'unlocked: pinned in pnpm-lock.yaml, with no version',
      'gone: named upstream, but nothing pins it',
    ]);
  });

  test('let a fully named and pinned set through', () => {
    expect(pinProblems([{ tool: 'node', version: '>=22', where: 'package.json engines' }], new Map([['node', 'nodejs/node']]))).toEqual([]);
  });
});
