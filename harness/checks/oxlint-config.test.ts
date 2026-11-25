/**
 * Oxlint's configuration over a population: the rules and overrides that name members read them from
 * their roles, wherever a member sits, and the ignore patterns are exactly the listed lintable files
 * the population does not hold.
 */

import { describe, expect, test } from 'vitest';
import { list, object, strings } from '#lib/config.ts';
import type { Population } from '#lib/scope.ts';
import { matches } from '#lib/globs.ts';
import { oxlintConfig } from '#lib/config-modules.ts';
import { oxlintConfigOf } from '#lib/oxlint-config.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { population } from '#lib/scope.ts';

const HARNESS_ID = 'oxlint-config';

/** Where the reducer override sits among a configuration's overrides, when a system has a model. */
const PURITY = 0;

/** Where the node override sits after it. */
const NODE = 1;

/**
 * Whether one of oxlint's ignore patterns matches a file.
 *
 * @param {readonly string[]} patterns - The patterns.
 * @param {string} file - The file.
 * @returns {boolean} Whether a pattern matches it.
 */
function ignoredBy(patterns: readonly string[], file: string): boolean {
  return patterns.some((pattern) => matches(pattern, file));
}

/** A listed module oxlint lints, by its extension. */
const LINTABLE = /\.(?:[cm]?[jt]sx?)$/u;

/** The settings of a configuration that name members. */
interface MemberSettings {
  readonly mechanics: unknown;
  readonly flags: unknown;
  readonly owners: unknown;
  readonly files: readonly unknown[];
}

/**
 * The settings over a planted population that name its members: the mechanics' files, a rule the test
 * infrastructure is outside of, the store owners, and each override's files.
 *
 * @param {Population} held - The population.
 * @returns {MemberSettings} The settings.
 */
function memberSettings(held: Population): MemberSettings {
  const config = oxlintConfigOf(held);
  const rules = config.rules ?? {};
  return {
    files: list(config.overrides ?? [], 'overrides').map((override: unknown) => object(override, 'an override')['files']),
    flags: rules['aricanga/flags'],
    mechanics: rules['aricanga/mechanics'],
    owners: rules['aricanga/store-owner'],
  };
}

describe('the oxlint configuration of a planted population', () => {
  test("names each member by its role's modules, wherever the member sits", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      ['lib/sys/src/model/a.ts', 'lib/sys/src/system.ts', 'probe/tests/a.spec.ts', 'tools/core/src/a.ts'],
      [
        ['lib/sys/', 'system'],
        ['probe/', 'test-infrastructure'],
        ['tools/core/', 'foundation'],
      ],
    );
    const { files, flags, mechanics, owners } = memberSettings(held);
    expect([mechanics, flags, owners, files.at(PURITY)]).toStrictEqual([
      ['error', { files: ['lib/sys/src/model/**', 'tools/core/**'] }],
      ['error', { ignore: ['probe/**'] }],
      ['error', { owners: ['**/snapshot-adapter.ts', 'probe/**'] }],
      ['lib/sys/src/system.ts', 'lib/sys/src/model/**'],
    ]);
    expect(files.at(NODE)).toContain('probe/tests/**');
  });

  test('has no reducer override without a system model, and no glob the listing leaves empty', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      ['packages/core/src/a.ts'],
      [
        ['packages/core/', 'foundation'],
        ['packages/other/', 'system'],
      ],
    );
    const { files, mechanics } = memberSettings(held);
    expect([mechanics, files.at(PURITY)]).toStrictEqual([
      ['error', { files: ['packages/core/**'] }],
      [
        'harness/**',
        '**/test/**',
        '**/*.spec.ts',
        '**/*.test.{ts,tsx}',
        '**/vite.config.ts',
        '**/playwright.*.config.ts',
        'knip.config.ts',
        'oxlint.config.ts',
        'vitest.gate.config.ts',
      ],
    ]);
  });
});

describe('the repository', () => {
  test('ignores every listed lintable file the population does not hold, and no file it holds', async () => {
    expect.hasAssertions();
    const [config, held] = await Promise.all([oxlintConfig(), population()]);
    const patterns = strings(config['ignorePatterns'], 'ignorePatterns');
    const lintable = held.listing.filter((file) => LINTABLE.test(file));
    const unheld = lintable.filter((file) => !held.holds(file));
    const heldFiles = lintable.filter((file) => held.holds(file));
    expect([unheld.filter((file) => !ignoredBy(patterns, file)), heldFiles.filter((file) => ignoredBy(patterns, file))]).toStrictEqual([
      [],
      [],
    ]);
    expect(unheld).not.toStrictEqual([]);
  });
});

export { HARNESS_ID };
