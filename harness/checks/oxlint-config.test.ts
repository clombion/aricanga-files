/**
 * Oxlint's configuration names each member by its role, and oxlint lints exactly the held lintable files.
 *
 * The rules and overrides that name members read them from their roles; oxlint, run as the lint
 * task runs it, lists the files it lints, and the check compares that list (never an emulation of
 * oxlint's globs) with the listed lintable files the population holds.
 */

import { REPO_ROOT, fromRoot } from '#lib/paths.ts';
import { ROOT_CONFIG_MODULES, knipConfig, oxlintConfig } from '#lib/config-modules.ts';
import { describe, expect, test } from 'vitest';
import { namedOverrides, oxlintConfigOf } from '#lib/oxlint-config.ts';
import { EXIT_CLEAN } from '#lib/exit-status.ts';
import type { Population } from '#lib/scope.ts';
import { fieldMatches } from '#lint-rules/globs.ts';
import { isLintable } from '#lib/source-files.ts';
import { lintedFiles } from '#lib/lint-rules.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { population } from '#lib/scope.ts';

const HARNESS_ID = 'oxlint-config';

/**
 * A root configuration module's default export, loaded by the path the tasks name.
 *
 * @param {string} file - The module, relative to the root.
 * @returns {Promise<unknown>} Its default export.
 */
async function defaultExport(file: string): Promise<unknown> {
  const loaded: unknown = await import(fromRoot(file));
  return typeof loaded === 'object' && loaded !== null && 'default' in loaded ? loaded.default : undefined;
}

/** The settings of a configuration that name members. */
interface MemberSettings {
  readonly mechanics: unknown;
  readonly flags: unknown;
  readonly owners: unknown;
  readonly purity: unknown;
  readonly node: readonly string[] | undefined;
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
  const { rules } = config;
  return {
    flags: rules['aricanga/flags'],
    mechanics: rules['aricanga/mechanics'],
    node: namedOverrides(held).get('node')?.files,
    owners: rules['aricanga/store-owner'],
    purity: namedOverrides(held).get('reducer-purity')?.files,
  };
}

/**
 * The files of the node override over a population.
 *
 * @param {Population} held - The population.
 * @returns {readonly string[]} Its files; none where it has no node override.
 */
function nodeFiles(held: Population): readonly string[] {
  return namedOverrides(held).get('node')?.files ?? [];
}

describe('the oxlint configuration of a planted population', () => {
  test("names each member by its role's modules, wherever the member sits", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      ['lib/sys/src/model/a.ts', 'lib/sys/src/system.ts', 'lib/sys/tests/a.ts', 'probe/tests/a.spec.ts', 'tools/core/src/a.ts'],
      [
        ['lib/sys/', 'system'],
        ['probe/', 'test-infrastructure'],
        ['tools/core/', 'foundation'],
      ],
    );
    const { flags, mechanics, node, owners, purity } = memberSettings(held);
    expect([mechanics, flags, owners, purity]).toStrictEqual([
      ['error', { files: ['lib/sys/src/model/**', 'tools/core/**'] }],
      ['error', { ignore: ['probe/**'] }],
      ['error', { owners: ['**/snapshot-adapter.ts', 'probe/**'] }],
      ['lib/sys/src/system.ts', 'lib/sys/src/model/**'],
    ]);
    expect([node?.includes('probe/tests/**'), node?.includes('lib/sys/tests/**')]).toStrictEqual([true, false]);
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
    const { mechanics, node, purity } = memberSettings(held);
    expect([mechanics, purity, node]).toStrictEqual([
      ['error', { files: ['packages/core/**'] }],
      undefined,
      [
        'harness/**',
        './knip.config.ts',
        './oxlint.config.ts',
        './vitest.gate.config.ts',
        '**/*.spec.ts',
        '**/*.test.{ts,tsx}',
        '**/vite.config.ts',
        '**/playwright.*.config.{ts,tsx}',
      ],
    ]);
  });
});

describe('the Node env of test support', () => {
  test("reaches a member's test directory at any depth below it, and not a member that sits under a test directory", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      ['packages/test/kit/src/a.ts', 'packages/ok/test/b.ts', 'packages/ok/src/test/c.ts', 'packages/ok/src/d.ts'],
      [
        ['packages/test/kit/', 'system'],
        ['packages/ok/', 'system'],
      ],
    );
    const node = nodeFiles(held);
    const inNode = (file: string): boolean => node.some((glob) => fieldMatches('files', glob, file));
    expect(
      ['packages/test/kit/src/a.ts', 'packages/ok/test/b.ts', 'packages/ok/src/test/c.ts', 'packages/ok/src/d.ts'].map((file) =>
        inNode(file),
      ),
    ).toStrictEqual([false, true, true, false]);
  });
});

describe('the oxlint configuration of a population with no mechanics', () => {
  test('turns the Solid ban off where no member has a mechanics module, since its files may not be empty', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(['ui/view/src/a.tsx'], [['ui/view/', 'view']]);
    expect(oxlintConfigOf(held).rules['aricanga/mechanics']).toBe('off');
  });
});

describe('the repository', () => {
  test("loads oxlint's and knip's configurations, typed, from the root modules the tasks name", async () => {
    expect.hasAssertions();
    const [oxlint, knip] = await Promise.all([oxlintConfig(), knipConfig()]);
    const [oxlintModule, knipModule] = await Promise.all([
      defaultExport(ROOT_CONFIG_MODULES.oxlint),
      defaultExport(ROOT_CONFIG_MODULES.knip),
    ]);
    expect([JSON.stringify(oxlint), JSON.stringify(knip)]).toStrictEqual([JSON.stringify(oxlintModule), JSON.stringify(knipModule)]);
  });

  test('oxlint, as the lint task runs it, lints exactly the listed lintable files the population holds', async () => {
    expect.hasAssertions();
    const [linted, held] = await Promise.all([lintedFiles(REPO_ROOT), population()]);
    const listed = new Set(held.listing);
    const lintable = held.listing.filter((file) => isLintable(file));
    expect([linted.status, linted.files.filter((file) => listed.has(file))]).toStrictEqual([
      EXIT_CLEAN,
      lintable.filter((file) => held.holds(file)).toSorted(),
    ]);
    expect(lintable.filter((file) => !held.holds(file))).not.toStrictEqual([]);
  });
});

export { HARNESS_ID };
