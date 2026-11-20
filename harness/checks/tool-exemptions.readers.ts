/** The readers of each tool's configuration: every glob it holds, as an entry the `tool-exemptions` check matches. */

import { object } from '#lib/config.ts';

/**
 * A config field read as a list of strings; an absent field is an empty list.
 *
 * @param {unknown} value - The field's value.
 * @param {string} what - The field, for the error.
 * @returns {string[]} The field's strings.
 */
function strings(value: unknown, what: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    throw new TypeError(`${what} is not a list of strings`);
  }
  return value;
}

/** A glob of a tool's configuration, with where it was read. */
interface Entry {
  readonly tool: string;
  readonly glob: string;
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

/** A Biome pattern that names a file, by its extension, or everything under a folder, by its `/**` end. */
const NAMES_FILES = /(?:\/\*\*|\.[\w*]+)$/u;

/**
 * A Biome exclusion as the files it excludes: a folder pattern, such as `docs`, excludes everything under it.
 *
 * @param {string} glob - The exclusion, without its `!`.
 * @returns {string} The glob of the files it excludes.
 */
function underFolder(glob: string): string {
  return NAMES_FILES.test(glob) ? glob : `${glob}/**`;
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
    glob.startsWith('!')
      ? { glob: underFolder(glob.slice('!'.length)), tool: 'biome files.includes (exclusion)' }
      : { glob, tool: 'biome files.includes' },
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
    ...Object.entries(workspaces).flatMap(([workspace, settings]: readonly [string, unknown]) =>
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

export { biomeEntries, knipEntries, oxfmtEntries, oxlintEntries, stylelintEntries, vitestEntries };
export type { Entry };
