/**
 * Every tool exemption is live: each ignore, override, include and exclude glob matches a listed file.
 *
 * The globs read: oxlint's `ignorePatterns` and each override's `files`; the gate's Vitest config,
 * its coverage `include` and `exclude` and each project's `include`; and, once their configuration exists, oxfmt's
 * `ignorePatterns` and stylelint's `ignoreFiles`
 * and `.stylelintignore`. A glob that matches nothing either names a path that is gone or a policy
 * for files that do not exist yet: the first is deleted, the second is declared in `POLICIES` with
 * its reason, and a declared policy that starts matching listed files fails as stale.
 */

import { ConfigError, parsed } from '#lib/config.ts';
import { Exemptions, site } from '#lib/exemptions.ts';
import { describe, expect, test } from 'vitest';
import { fieldMatches, matches } from '#lint-rules/globs.ts';
import { oxfmtEntries, oxlintEntries, stylelintEntries, vitestEntries } from './tool-exemptions.readers.ts';
import { textOf, tracked } from '#lib/source-files.ts';
import type { Entry } from './tool-exemptions.readers.ts';
import type { OxlintField } from '#lint-rules/globs.ts';
import { Project } from '#lib/tools.ts';
import { gateConfig } from './gate-config.ts';
import { oxlintConfig } from '#lib/config-modules.ts';
import { plantedLintRun } from '#lib/lint-rules.ts';

const HARNESS_ID = 'tool-exemptions';

/** Globs allowed to match no listed file, keyed by `site(tool, glob)`, each with its reason. */
const POLICIES = new Exemptions({});

/**
 * The entries whose glob matches none of `paths`.
 *
 * @param {readonly Entry[]} entries - The entries.
 * @param {readonly string[]} paths - The paths.
 * @returns {Entry[]} The entries whose glob matches none of `paths`.
 */
function deadEntries(entries: readonly Entry[], paths: readonly string[]): Entry[] {
  return entries.filter((entry) =>
    paths.every((target) => !(entry.reading === 'root' ? matches(entry.glob, target) : fieldMatches(entry.reading, entry.glob, target))),
  );
}

async function listedJson(path: string): Promise<unknown> {
  const listed = await tracked();
  if (!listed.includes(path)) {
    return undefined;
  }
  const text = await textOf(path);
  return parsed(text, path);
}

async function repoEntries(): Promise<Entry[]> {
  const [vitest, oxfmt, stylelint, oxlint, listed] = await Promise.all([
    gateConfig(),
    listedJson('.oxfmtrc.json'),
    listedJson('.stylelintrc.json'),
    oxlintConfig(),
    tracked(),
  ]);
  const stylelintIgnore = listed.includes('.stylelintignore') ? await textOf('.stylelintignore') : '';
  return [
    ...oxlintEntries(oxlint),
    ...vitestEntries(vitest),
    ...(oxfmt === undefined ? [] : oxfmtEntries(oxfmt)),
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
  test('a glob matches through directories, a trailing /** matches a directory, and a harness glob has no anchor', () => {
    expect.hasAssertions();
    const cases = [
      ['packages/*/src/**', 'packages/plant/src/a.ts'],
      ['**/*.test.ts', 'packages/plant/src/a.test.ts'],
      ['docs/**', 'docs/x.md'],
      ['./docs/**', 'docs/x.md'],
      ['/docs/**', 'docs/x.md'],
      ['**/snapshot-adapter.ts', 'snapshot-adapter.ts'],
      ['src/**/*.{ts,tsx}', 'src/a.tsx'],
      ['packages/*/src/*.css', 'packages/plant/src/a.ts'],
      ['/docs/**', 'packages/docs/x.md'],
    ] as const;
    expect(cases.map(([glob, target]) => matches(glob, target))).toStrictEqual([true, true, true, false, false, true, true, false, false]);
  });
});

/** The files of the planted project the field readings are asked about. */
const FIELD_FILES: readonly string[] = ['a.ts', 'pkg/a.ts', 'pkg/x/a.ts', 'x/a.ts', 'x/sub/b.ts'];

/** Globs written into each oxlint field: slashless, each anchor, slash-holding, a subtree, a directory, a trailing slash. */
const FIELD_GLOBS: readonly string[] = ['a.ts', 'x', './a.ts', './x', '/a.ts', '/x', 'x/**', './x/**', '/x/**', 'pkg/x', '**/x', 'x/'];

/**
 * The planted files oxlint matches with one glob in one field: the files it lints under an ignore
 * pattern, or the files an override turning on `no-debugger` reports.
 *
 * @param {OxlintField} field - The field.
 * @param {string} glob - The glob.
 * @returns {Promise<readonly string[]>} The matched files, sorted.
 */
async function oxlintMatched(field: OxlintField, glob: string): Promise<readonly string[]> {
  const project = await Project.create({ linkModules: false });
  try {
    await project.writeAll(FIELD_FILES.map((file) => [file, 'debugger;\n'] as const));
    const config =
      field === 'ignorePatterns'
        ? { categories: {}, ignorePatterns: [glob], rules: { 'no-debugger': 'error' } }
        : { categories: {}, overrides: [{ files: [glob], rules: { 'no-debugger': 'error' } }], rules: { 'no-debugger': 'off' } };
    await project.write('planted.json', JSON.stringify(config));
    const done = await project.tool('oxlint', ...(await plantedLintRun('planted.json')), '--format', 'unix', '.');
    const reported = new Set(done.stdout.split('\n').flatMap((line) => FIELD_FILES.filter((file) => line.startsWith(`${file}:`))));
    return field === 'ignorePatterns'
      ? FIELD_FILES.filter((file) => !reported.has(file))
      : FIELD_FILES.filter((file) => reported.has(file));
  } finally {
    await project.remove();
  }
}

describe("oxlint's fields", () => {
  test.each(['files', 'ignorePatterns'] as const)('the matcher reads a glob in %s as oxlint does, each anchor and depth', async (field) => {
    expect.hasAssertions();
    const read = FIELD_GLOBS.map((glob) => [glob, FIELD_FILES.filter((file) => fieldMatches(field, glob, file))] as const);
    const found = await Promise.all(FIELD_GLOBS.map(async (glob) => [glob, await oxlintMatched(field, glob)] as const));
    expect(read).toStrictEqual(found);
  });

  test("the census reads a glob with the other field's anchor as dead", () => {
    expect.hasAssertions();
    const entries = oxlintEntries({
      ignorePatterns: ['./docs/**', '/docs/**'],
      overrides: [{ files: ['/docs/x.md', './docs/x.md'], rules: {} }],
    });
    expect(deadEntries(entries, ['docs/x.md'])).toStrictEqual([
      { glob: './docs/**', reading: 'ignorePatterns', tool: 'oxlint ignorePatterns' },
      { glob: '/docs/x.md', reading: 'files', tool: 'oxlint overrides' },
    ]);
  });
});

describe('the readers', () => {
  const LISTED = ['packages/plant/src/a.ts', 'packages/plant/src/a.test.ts', 'packages/plant/src/b.css', 'docs/x.md'];

  test('sees a dead oxlint ignore and a dead override, and lets live ones through', () => {
    expect.hasAssertions();
    const entries = oxlintEntries({
      ignorePatterns: ['docs/**', 'gone/**'],
      overrides: [
        { files: ['packages/plant/**'], rules: {} },
        { files: ['packages/gone/**'], rules: {} },
      ],
    });
    expect(deadEntries(entries, LISTED)).toStrictEqual([
      { glob: 'gone/**', reading: 'ignorePatterns', tool: 'oxlint ignorePatterns' },
      { glob: 'packages/gone/**', reading: 'files', tool: 'oxlint overrides' },
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

  test("refuses a gate config with no projects, as every reader of the gate's config does", () => {
    expect.hasAssertions();
    expect(() => vitestEntries({ test: { coverage: { exclude: [], include: [] } } })).toThrow(
      new ConfigError('projects is not a list: undefined'),
    );
  });
});

describe('the readers of the other tools', () => {
  const LISTED = ['packages/plant/src/a.ts', 'packages/plant/src/a.test.ts', 'packages/plant/src/b.css', 'docs/x.md'];

  test('reads oxfmt and stylelint ignores', () => {
    expect.hasAssertions();
    expect(oxfmtEntries({ ignorePatterns: ['docs/**'] })).toStrictEqual([
      { glob: 'docs/**', reading: 'root', tool: 'oxfmt ignorePatterns' },
    ]);
    expect(stylelintEntries({ ignoreFiles: ['**/b.css'] }, '# a comment\n\ngone/**\n')).toStrictEqual([
      { glob: '**/b.css', reading: 'root', tool: 'stylelint ignoreFiles' },
      { glob: 'gone/**', reading: 'root', tool: '.stylelintignore' },
    ]);
  });

  test('a declared policy passes while it matches nothing, and fails as stale once it matches', () => {
    expect.hasAssertions();
    const policies = new Exemptions({ [site('oxlint ignorePatterns', '**/dist/**')]: 'planted: build output' });
    const unmatched = deadEntries([{ glob: '**/dist/**', reading: 'ignorePatterns', tool: 'oxlint ignorePatterns' }], LISTED);
    expect(policies.unexemptedBy(unmatched, (entry) => site(entry.tool, entry.glob))).toStrictEqual([]);
    const nowMatching = deadEntries([{ glob: '**/dist/**', reading: 'ignorePatterns', tool: 'oxlint ignorePatterns' }], ['a/dist/x.js']);
    expect(() => policies.unexemptedBy(nowMatching, (entry) => site(entry.tool, entry.glob))).toThrow('stale');
  });
});

describe('a tool config', () => {
  test('refuses a field written as JSON null where a list is read: null is not an absent field', () => {
    expect.hasAssertions();
    expect(() => oxfmtEntries(parsed('{"ignorePatterns":null}', 'a planted config'))).toThrow(
      new ConfigError('ignorePatterns is not a list: null'),
    );
  });
});

export { HARNESS_ID, deadEntries };
