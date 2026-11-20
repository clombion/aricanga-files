/**
 * Every tool exemption is live: each ignore, override, include and exclude glob matches a listed file.
 *
 * The globs read: oxlint's `ignorePatterns` and each override's `files`; the gate's Vitest config,
 * its coverage `include` and `exclude` and each project's `include`; Biome's `files.includes`
 * (`!` entries are its exclusions); and, once their configuration exists, oxfmt's
 * `ignorePatterns`, knip's `ignore` (top level and per workspace) and stylelint's `ignoreFiles`
 * and `.stylelintignore`. A glob that matches nothing either names a path that is gone or a policy
 * for files that do not exist yet: the first is deleted, the second is declared in `POLICIES` with
 * its reason, and a declared policy that starts matching listed files fails as stale.
 */

import { Exemptions, site } from '#lib/exemptions.ts';
import { dead, matches } from '#lib/globs.ts';
import { describe, expect, test } from 'vitest';
import { json, object } from '#lib/config.ts';
import { textOf, tracked } from '#lib/source-files.ts';
import { fromRoot } from '#lib/paths.ts';

const HARNESS_ID = 'tool-exemptions';

/** A glob of a tool's configuration, with where it was read. */
interface Entry {
  readonly tool: string;
  readonly glob: string;
}

/** Globs allowed to match no listed file, keyed by `site(tool, glob)`, each with its reason. */
const POLICIES = new Exemptions({
  [site('oxlint overrides[6]', '**/*.test.tsx')]:
    'policy: a component test is a .test.tsx and runs on Node like every test; the override holds the first one when it lands',
});

function strings(value: unknown, what: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    throw new TypeError(`${what} is not a list of strings`);
  }
  return value;
}

/**
 * oxlint's ignore patterns and override file globs.
 *
 * @param {unknown} config - The config.
 * @returns {Entry[]} oxlint's ignore patterns and override file globs.
 */
function oxlintEntries(config: unknown): Entry[] {
  const fields = object(config, '.oxlintrc.json');
  const overrides = fields['overrides'] === undefined ? [] : fields['overrides'];
  if (!Array.isArray(overrides)) {
    throw new TypeError('.oxlintrc.json overrides is not a list');
  }
  return [
    ...strings(fields['ignorePatterns'], 'ignorePatterns').map((glob) => ({ glob, tool: 'oxlint ignorePatterns' })),
    ...overrides.flatMap((override: unknown, index) =>
      strings(object(override, `override ${index}`)['files'], `override ${index} files`).map((glob) => ({
        glob,
        tool: `oxlint overrides[${index}]`,
      })),
    ),
  ];
}

/**
 * The gate's Vitest config: coverage include and exclude, and each project's include.
 *
 * @param {unknown} config - The config.
 * @returns {Entry[]} The gate's Vitest config: coverage include and exclude, and each project's include.
 */
function vitestEntries(config: unknown): Entry[] {
  const testOptions = object(object(config, 'vitest config')['test'] ?? {}, 'test');
  const coverage = object(testOptions['coverage'] ?? {}, 'coverage');
  const projects = testOptions['projects'] === undefined ? [] : testOptions['projects'];
  if (!Array.isArray(projects)) {
    throw new TypeError('vitest projects is not a list');
  }
  return [
    ...strings(coverage['include'], 'coverage.include').map((glob) => ({ glob, tool: 'vitest coverage.include' })),
    ...strings(coverage['exclude'], 'coverage.exclude').map((glob) => ({ glob, tool: 'vitest coverage.exclude' })),
    ...projects.flatMap((project: unknown, index) =>
      strings(object(object(project, `project ${index}`)['test'] ?? {}, 'test')['include'], 'include').map((glob) => ({
        glob,
        tool: `vitest projects[${index}].include`,
      })),
    ),
  ];
}

/**
 * Biome's `files.includes`, a `!` entry read as the exclusion it is.
 *
 * @param {unknown} config - The config.
 * @returns {Entry[]} Biome's `files.includes`, a `!` entry read as the exclusion it is.
 */
function biomeEntries(config: unknown): Entry[] {
  const files = object(object(config, 'biome.json')['files'] ?? {}, 'files');
  return strings(files['includes'], 'files.includes').map((glob) =>
    glob.startsWith('!') ? { glob: glob.slice('!'.length), tool: 'biome files.includes (exclusion)' } : { glob, tool: 'biome files.includes' },
  );
}

/**
 * The ignore patterns of `oxfmt`.
 *
 * @param {unknown} config - The config.
 * @returns {Entry[]} The ignore patterns of `oxfmt`.
 */
function oxfmtEntries(config: unknown): Entry[] {
  return strings(object(config, '.oxfmtrc.json')['ignorePatterns'], 'ignorePatterns').map((glob) => ({
    glob,
    tool: 'oxfmt ignorePatterns',
  }));
}

/**
 * The `ignore` of `knip`, at the top level and per workspace.
 *
 * @param {unknown} config - The config.
 * @returns {Entry[]} The `ignore` of `knip`, at the top level and per workspace.
 */
function knipEntries(config: unknown): Entry[] {
  const fields = object(config, 'knip.json');
  const workspaces = object(fields['workspaces'] ?? {}, 'workspaces');
  return [
    ...strings(fields['ignore'], 'ignore').map((glob) => ({ glob, tool: 'knip ignore' })),
    ...Object.entries(workspaces).flatMap(([workspace, settings]) =>
      strings(object(settings, workspace)['ignore'], `${workspace}.ignore`).map((glob) => ({
        glob: workspace === '.' ? glob : `${workspace}/${glob}`,
        tool: `knip workspaces[${workspace}].ignore`,
      })),
    ),
  ];
}

/**
 * The `ignoreFiles` of `stylelint` and the lines of `.stylelintignore`.
 *
 * @param {unknown} config - The config.
 * @param {string} ignoreFile - The ignore file.
 * @returns {Entry[]} The `ignoreFiles` of `stylelint` and the lines of `.stylelintignore`.
 */
function stylelintEntries(config: unknown, ignoreFile: string): Entry[] {
  return [
    ...strings(object(config, '.stylelintrc.json')['ignoreFiles'], 'ignoreFiles').map((glob) => ({
      glob,
      tool: 'stylelint ignoreFiles',
    })),
    ...ignoreFile
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((glob) => ({ glob, tool: '.stylelintignore' })),
  ];
}

/**
 * The entries whose glob matches none of `paths`.
 *
 * @param {readonly Entry[]} entries - The entries.
 * @param {readonly string[]} paths - The paths.
 * @returns {Entry[]} The entries whose glob matches none of `paths`.
 */
function deadEntries(entries: readonly Entry[], paths: readonly string[]): Entry[] {
  const unmatched = new Set(dead(entries.map((entry) => entry.glob), paths));
  return entries.filter((entry) => unmatched.has(entry.glob));
}

function listedJson(path: string): unknown {
  return tracked().includes(path) ? json(textOf(path)) : undefined;
}

async function repoEntries(): Promise<Entry[]> {
  const vitestModule: unknown = await import(fromRoot('vitest.gate.config.ts'));
  const vitest = object(vitestModule, 'vitest.gate.config.ts')['default'];
  const oxfmt = listedJson('.oxfmtrc.json');
  const knip = listedJson('knip.json');
  const stylelint = listedJson('.stylelintrc.json');
  const stylelintIgnore = tracked().includes('.stylelintignore') ? textOf('.stylelintignore') : '';
  return [
    ...oxlintEntries(json(textOf('.oxlintrc.json'))),
    ...vitestEntries(vitest),
    ...biomeEntries(json(textOf('biome.json'))),
    ...(oxfmt === undefined ? [] : oxfmtEntries(oxfmt)),
    ...(knip === undefined ? [] : knipEntries(knip)),
    ...stylelintEntries(stylelint ?? {}, stylelintIgnore),
  ];
}

describe('the repository', () => {
  test('every tool glob matches a listed file, or is a declared policy', async () => {
    expect.hasAssertions();
    const unmatched = deadEntries(await repoEntries(), tracked());
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

  test('reads a biome exclusion as the glob it excludes', () => {
    expect.hasAssertions();
    expect(biomeEntries({ files: { includes: ['packages/**/*.css', '!**/gone/**'] } })).toStrictEqual([
      { glob: 'packages/**/*.css', tool: 'biome files.includes' },
      { glob: '**/gone/**', tool: 'biome files.includes (exclusion)' },
    ]);
  });

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

export { HARNESS_ID, biomeEntries, deadEntries, knipEntries, oxfmtEntries, oxlintEntries, stylelintEntries, vitestEntries };
