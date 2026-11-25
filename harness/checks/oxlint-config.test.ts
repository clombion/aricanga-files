/**
 * Oxlint's configuration names each member by its role, and oxlint lints exactly the held lintable files.
 *
 * The rules and overrides that name members read them from their roles; oxlint, run as the lint
 * task runs it, lists the files it lints, and the check compares that list (never an emulation of
 * oxlint's globs) with the listed lintable files the population holds.
 */

import { describe, expect, test } from 'vitest';
import { list, object, strings } from '#lib/config.ts';
import { EXIT_CLEAN } from '#lib/exit-status.ts';
import type { Population } from '#lib/scope.ts';
import { REPO_ROOT } from '#lib/paths.ts';
import { fieldMatches } from '#lint-rules/globs.ts';
import { isLintable } from '#lib/oxlint-files.ts';
import { lintedFiles } from '#lib/lint-rules.ts';
import { oxlintConfigOf } from '#lib/oxlint-config.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { population } from '#lib/scope.ts';

const HARNESS_ID = 'oxlint-config';

/** Where the reducer override sits among a configuration's overrides, when a system has a model. */
const PURITY = 0;

/** Where the node override sits after it. */
const NODE = 1;

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
        '**/*.spec.ts',
        '**/*.test.{ts,tsx}',
        '**/vite.config.ts',
        '**/playwright.*.config.ts',
        './knip.config.ts',
        './oxlint.config.ts',
        './vitest.gate.config.ts',
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
    const { files } = memberSettings(held);
    // No system has a reducer surface here, so the node override comes first.
    const node = strings(files.at(PURITY), 'the node override files');
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
    expect(oxlintConfigOf(held).rules?.['aricanga/mechanics']).toBe('off');
  });
});

describe('the repository', () => {
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
