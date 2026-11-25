/** The readers of each tool's configuration: every glob it holds, as an entry the `tool-exemptions` check matches. */

import { absentAs, list, object, strings } from '#lib/config.ts';
import { coverageOf, globsOf, projectsOf, testOf } from './gate-config.ts';

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
  const fields = object(config, 'oxlint.config.ts');
  const overrides = list(absentAs(fields['overrides'], []), 'oxlint.config.ts overrides');
  return [
    ...strings(absentAs(fields['ignorePatterns'], []), 'ignorePatterns').map((glob) => ({ glob, tool: 'oxlint ignorePatterns' })),
    ...overrides.flatMap((override: unknown, index) =>
      strings(absentAs(object(override, `override ${index}`)['files'], []), `override ${index} files`).map((glob) => ({
        glob,
        tool: `oxlint overrides[${index}]`,
      })),
    ),
  ];
}

/**
 * The gate's Vitest config, read through the gate config's own readers (`gate-config.ts`): coverage
 * include and exclude, and each project's include.
 *
 * @param {unknown} config - The config.
 * @returns {Entry[]} The gate's Vitest config: coverage include and exclude, and each project's include.
 */
function vitestEntries(config: unknown): Entry[] {
  const test = testOf(object(config, 'vitest config'));
  const coverage = coverageOf(test);
  return [
    ...globsOf(coverage, 'include').map((glob) => ({ glob, tool: 'vitest coverage.include' })),
    ...globsOf(coverage, 'exclude').map((glob) => ({ glob, tool: 'vitest coverage.exclude' })),
    ...projectsOf(test).flatMap((project, index) =>
      globsOf(project, 'include').map((glob) => ({ glob, tool: `vitest projects[${index}].include` })),
    ),
  ];
}

/**
 * The ignore patterns of `oxfmt`.
 *
 * @param {unknown} config - The config.
 * @returns {Entry[]} The ignore patterns of `oxfmt`.
 */
function oxfmtEntries(config: unknown): Entry[] {
  return strings(absentAs(object(config, '.oxfmtrc.json')['ignorePatterns'], []), 'ignorePatterns').map((glob) => ({
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
    ...strings(absentAs(fields['ignore'], []), 'ignore').map((glob) => ({ glob, tool: 'knip ignore' })),
    ...Object.entries(workspaces).flatMap(([workspace, settings]: readonly [string, unknown]) =>
      strings(absentAs(object(settings, workspace)['ignore'], []), `${workspace}.ignore`).map((glob) => ({
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
    ...strings(absentAs(object(config, '.stylelintrc.json')['ignoreFiles'], []), 'ignoreFiles').map((glob) => ({
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

export { knipEntries, oxfmtEntries, oxlintEntries, stylelintEntries, vitestEntries };
export type { Entry };
