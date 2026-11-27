/** The packages a lockfile locks at two versions: read over every importer, a workspace link and a peer suffix aside. */

import { describe, expect, test } from 'vitest';
import { lockSplits } from '#lib/lock-splits.ts';

/** A lockfile whose importers lock `solid-js` at two versions, `vite` at one under two peer suffixes, and link one workspace package two ways. */
const SPLIT = [
  'importers:',
  '  .:',
  '    dependencies:',
  '      solid-js:',
  "        specifier: 'catalog:'",
  '        version: 2.0.3',
  '      local:',
  "        specifier: 'workspace:*'",
  '        version: link:packages/local',
  '      vite:',
  "        specifier: 'catalog:'",
  '        version: 8.3.8(peer@1.0.0)',
  '  experiences/sandbox:',
  '    dependencies:',
  '      solid-js:',
  '        specifier: 2.0.4',
  '        version: 2.0.4',
  '      local:',
  "        specifier: 'workspace:*'",
  '        version: link:../../packages/local',
  '      vite:',
  "        specifier: 'catalog:'",
  '        version: 8.3.8(peer@2.0.0)',
  '  packages/app:',
  '    devDependencies:',
  '      solid-js:',
  "        specifier: 'catalog:'",
  '        version: 2.0.3',
  '',
].join('\n');

describe('the split packages of a lockfile', () => {
  test('name a package locked at two versions with the importers of each, and no link or peer suffix', () => {
    expect.hasAssertions();
    expect(lockSplits(SPLIT)).toStrictEqual(['solid-js: 2.0.3 (., packages/app), 2.0.4 (experiences/sandbox)']);
  });

  test('name each split package once, ordered by name', () => {
    expect.hasAssertions();
    const two = SPLIT.replace('version: 8.3.8(peer@2.0.0)', 'version: 8.4.0')
      .replace('  .:\n', "  .:\n    devDependencies:\n      ab:\n        specifier: '1'\n        version: 1.0.0\n")
      .replace(
        '  packages/app:\n    devDependencies:\n',
        "  packages/app:\n    devDependencies:\n      ab:\n        specifier: '2'\n        version: 2.0.0\n",
      );
    expect(lockSplits(two)).toStrictEqual([
      'ab: 1.0.0 (.), 2.0.0 (packages/app)',
      'solid-js: 2.0.3 (., packages/app), 2.0.4 (experiences/sandbox)',
      'vite: 8.3.8 (.), 8.4.0 (experiences/sandbox)',
    ]);
  });

  test('find none where every importer locks a package at one version', () => {
    expect.hasAssertions();
    expect(
      lockSplits(SPLIT.replace('specifier: 2.0.4\n        version: 2.0.4', "specifier: 'catalog:'\n        version: 2.0.3")),
    ).toStrictEqual([]);
  });
});
