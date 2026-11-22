/**
 * Every tool exemption is live: each ignore, override, include and exclude glob matches a listed file.
 *
 * The globs read: oxlint's `ignorePatterns` and each override's `files`; the gate's Vitest config,
 * its coverage `include` and `exclude` and each project's `include`; and, once their configuration exists, oxfmt's
 * `ignorePatterns`, knip's `ignore` (top level and per workspace) and stylelint's `ignoreFiles`
 * and `.stylelintignore`. A glob that matches nothing either names a path that is gone or a policy
 * for files that do not exist yet: the first is deleted, the second is declared in `POLICIES` with
 * its reason, and a declared policy that starts matching listed files fails as stale.
 */

import { Exemptions, site } from '#lib/exemptions.ts';
import { dead, matches } from '#lib/globs.ts';
import { describe, expect, test } from 'vitest';
import { json, object } from '#lib/config.ts';
import { knipEntries, oxfmtEntries, oxlintEntries, stylelintEntries, vitestEntries } from './tool-exemptions.readers.ts';
import { textOf, tracked } from '#lib/source-files.ts';
import type { Entry } from './tool-exemptions.readers.ts';
import { fromRoot } from '#lib/paths.ts';

const HARNESS_ID = 'tool-exemptions';

/** Globs allowed to match no listed file, keyed by `site(tool, glob)`, each with its reason. */
const POLICIES = new Exemptions({
  [site('oxlint overrides[6]', '**/*.test.tsx')]:
    'policy: a component test is a .test.tsx and runs on Node like every test; the override holds the first one when it lands',
});

/**
 * The entries whose glob matches none of `paths`.
 *
 * @param {readonly Entry[]} entries - The entries.
 * @param {readonly string[]} paths - The paths.
 * @returns {Entry[]} The entries whose glob matches none of `paths`.
 */
function deadEntries(entries: readonly Entry[], paths: readonly string[]): Entry[] {
  const unmatched = new Set(
    dead(
      entries.map((entry) => entry.glob),
      paths,
    ),
  );
  return entries.filter((entry) => unmatched.has(entry.glob));
}

async function listedJson(path: string): Promise<unknown> {
  const listed = await tracked();
  if (!listed.includes(path)) {
    return undefined;
  }
  const text = await textOf(path);
  return json(text);
}

async function repoEntries(): Promise<Entry[]> {
  const vitestModule: unknown = await import(fromRoot('vitest.gate.config.ts'));
  const vitest = object(vitestModule, 'vitest.gate.config.ts')['default'];
  const [oxfmt, knip, stylelint, oxlint, listed] = await Promise.all([
    listedJson('.oxfmtrc.json'),
    listedJson('knip.json'),
    listedJson('.stylelintrc.json'),
    listedJson('.oxlintrc.json'),
    tracked(),
  ]);
  const stylelintIgnore = listed.includes('.stylelintignore') ? await textOf('.stylelintignore') : '';
  return [
    ...oxlintEntries(oxlint),
    ...vitestEntries(vitest),
    ...(oxfmt === undefined ? [] : oxfmtEntries(oxfmt)),
    ...(knip === undefined ? [] : knipEntries(knip)),
    ...stylelintEntries(stylelint ?? {}, stylelintIgnore),
  ];
}

describe('the repository', () => {
  test('every tool glob matches a listed file, or is a declared policy', async () => {
    expect.hasAssertions();
    const [entries, listed] = await Promise.all([repoEntries(), tracked()]);
    const unmatched = deadEntries(entries, listed);
    expect(POLICIES.unexemptedBy(unmatched, (entry) => site(entry.tool, entry.glob))).toStrictEqual([]);
  });
});

describe('the matcher', () => {
  test('a glob matches through directories and a trailing /** matches a directory', () => {
    expect.hasAssertions();
    expect(matches('packages/*/src/**', 'packages/plant/src/a.ts')).toBe(true);
    expect(matches('**/*.test.ts', 'packages/plant/src/a.test.ts')).toBe(true);
    expect(matches('docs/**', 'docs/x.md')).toBe(true);
    expect(matches('./docs/**', 'docs/x.md')).toBe(true);
    expect(matches('packages/*/src/*.css', 'packages/plant/src/a.ts')).toBe(false);
  });
});

describe('the readers', () => {
  const LISTED = ['packages/plant/src/a.ts', 'packages/plant/src/a.test.ts', 'packages/plant/src/b.css', 'docs/x.md'];

  test('sees a dead oxlint ignore and a dead override, and lets live ones through', () => {
    expect.hasAssertions();
    const entries = oxlintEntries({
      ignorePatterns: ['docs/**', 'gone/**'],
      overrides: [{ files: ['packages/plant/**'] }, { files: ['packages/gone/**'] }],
    });
    expect(deadEntries(entries, LISTED)).toStrictEqual([
      { glob: 'gone/**', tool: 'oxlint ignorePatterns' },
      { glob: 'packages/gone/**', tool: 'oxlint overrides[1]' },
    ]);
  });

  test('sees a dead coverage include, coverage exclude and project include', () => {
    expect.hasAssertions();
    const entries = vitestEntries({
      test: {
        coverage: { exclude: ['**/*.test.ts', '**/*.spec.ts'], include: ['packages/plant/src/**', 'packages/gone/src/**'] },
        projects: [{ test: { include: ['packages/**/*.test.ts'] } }, { test: { include: ['harness/checks/**/*.test.ts'] } }],
      },
    });
    expect(deadEntries(entries, LISTED).map((entry) => entry.glob)).toStrictEqual([
      'packages/gone/src/**',
      '**/*.spec.ts',
      'harness/checks/**/*.test.ts',
    ]);
  });
});

describe('the readers of the other tools', () => {
  const LISTED = ['packages/plant/src/a.ts', 'packages/plant/src/a.test.ts', 'packages/plant/src/b.css', 'docs/x.md'];

  test('reads oxfmt, knip and stylelint ignores', () => {
    expect.hasAssertions();
    expect(oxfmtEntries({ ignorePatterns: ['docs/**'] })).toStrictEqual([{ glob: 'docs/**', tool: 'oxfmt ignorePatterns' }]);
    expect(knipEntries({ ignore: ['docs/**'], workspaces: { 'packages/plant': { ignore: ['src/b.css'] } } })).toStrictEqual([
      { glob: 'docs/**', tool: 'knip ignore' },
      { glob: 'packages/plant/src/b.css', tool: 'knip workspaces[packages/plant].ignore' },
    ]);
    expect(stylelintEntries({ ignoreFiles: ['**/b.css'] }, '# a comment\n\ngone/**\n')).toStrictEqual([
      { glob: '**/b.css', tool: 'stylelint ignoreFiles' },
      { glob: 'gone/**', tool: '.stylelintignore' },
    ]);
  });

  test('a declared policy passes while it matches nothing, and fails as stale once it matches', () => {
    expect.hasAssertions();
    const policies = new Exemptions({ [site('oxlint ignorePatterns', '**/dist/**')]: 'planted: build output' });
    const unmatched = deadEntries([{ glob: '**/dist/**', tool: 'oxlint ignorePatterns' }], LISTED);
    expect(policies.unexemptedBy(unmatched, (entry) => site(entry.tool, entry.glob))).toStrictEqual([]);
    const nowMatching = deadEntries([{ glob: '**/dist/**', tool: 'oxlint ignorePatterns' }], ['a/dist/x.js']);
    expect(() => policies.unexemptedBy(nowMatching, (entry) => site(entry.tool, entry.glob))).toThrow('stale');
  });
});

export { HARNESS_ID, deadEntries };
