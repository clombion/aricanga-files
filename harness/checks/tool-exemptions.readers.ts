/** The readers of each tool's configuration: every glob it holds, as an entry the `tool-exemptions` check matches. */

import { absentAs, object, strings } from '#lib/config.ts';
import { coverageOf, globsOf, projectsOf, testOf } from './gate-config.ts';
import type { GateOxlintConfig } from '#lib/oxlint-shape.ts';
import type { OxlintField } from '#lint-rules/globs.ts';

/** How a tool reads a glob: from the root, as the harness's matcher reads it, or as one of oxlint's fields reads it. */
type Reading = 'root' | OxlintField;

/** A glob of a tool's configuration, with where it was read and how the tool reads it. */
interface Entry {
  readonly tool: string;
  readonly glob: string;
  readonly reading: Reading;
}

/**
 * oxlint's ignore patterns and override file globs.
 *
 * @param {Pick<GateOxlintConfig, 'ignorePatterns' | 'overrides'>} config - The config.
 * @returns {Entry[]} oxlint's ignore patterns and override file globs; an override's glob is keyed by itself, never by the override's place.
 */
function oxlintEntries(config: Pick<GateOxlintConfig, 'ignorePatterns' | 'overrides'>): Entry[] {
  return [
    ...config.ignorePatterns.map((glob): Entry => ({ glob, reading: 'ignorePatterns', tool: 'oxlint ignorePatterns' })),
    ...config.overrides.flatMap((override) => override.files.map((glob): Entry => ({ glob, reading: 'files', tool: 'oxlint overrides' }))),
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
    ...globsOf(coverage, 'include').map((glob): Entry => ({ glob, reading: 'root', tool: 'vitest coverage.include' })),
    ...globsOf(coverage, 'exclude').map((glob): Entry => ({ glob, reading: 'root', tool: 'vitest coverage.exclude' })),
    ...projectsOf(test).flatMap((project, index) =>
      globsOf(project, 'include').map((glob): Entry => ({ glob, reading: 'root', tool: `vitest projects[${index}].include` })),
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
  return strings(absentAs(object(config, '.oxfmtrc.json')['ignorePatterns'], []), 'ignorePatterns').map((glob): Entry => ({
    glob,
    reading: 'root',
    tool: 'oxfmt ignorePatterns',
  }));
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
    ...strings(absentAs(object(config, '.stylelintrc.json')['ignoreFiles'], []), 'ignoreFiles').map((glob): Entry => ({
      glob,
      reading: 'root',
      tool: 'stylelint ignoreFiles',
    })),
    ...ignoreFile
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((glob): Entry => ({ glob, reading: 'root', tool: '.stylelintignore' })),
  ];
}

export { oxfmtEntries, oxlintEntries, stylelintEntries, vitestEntries };
export type { Entry };
