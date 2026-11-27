/** The planted oxlint runs and config reads of the `boundaries` check. */

import { OXLINT_CONFIG_FILES, oxlintDiagnostics, plantedLintRun, writeOxlintConfig } from '#lib/lint-rules.ts';
import { list, object, parsed } from '#lib/config.ts';
import { Accepted } from '#lint-rules/exemptions.ts';
import type { Diagnostic } from '#lib/lint-rules.ts';
import type { Fixture } from './boundaries.plants.ts';
import type { Population } from '#lib/scope.ts';
import { Project } from '#lib/tools.ts';
import { isEmpty } from '#lib/lists.ts';
import { oxlintConfigOf } from '#lib/oxlint-config.ts';

/** A rule setting's options, after its severity. */
const OPTIONS = 1;

/** The rules the boundaries are. */
const BOUNDARY_RULES: Accepted<string> = new Accepted<string>([
  'eslint(no-restricted-globals)',
  'eslint(no-restricted-imports)',
  'eslint(no-restricted-properties)',
]);

/**
 * The boundary diagnostics oxlint reports for the fixtures, under a copy of the repository config.
 *
 * @param {readonly Fixture[]} fixtures - The fixtures.
 * @returns {Promise<readonly Diagnostic[]>} The diagnostics of the boundary rules.
 */
async function boundaryDiagnostics(fixtures: readonly Fixture[]): Promise<readonly Diagnostic[]> {
  const project = await Project.create({ copies: OXLINT_CONFIG_FILES });
  try {
    await writeOxlintConfig(project);
    await project.writeAll(fixtures.map((fixture) => [fixture.path, fixture.text] as const));
    const outcome = await project.tool(
      'oxlint',
      ...(await plantedLintRun()),
      '-A',
      'all',
      '--format',
      'json',
      ...fixtures.map((fixture) => fixture.path),
    );
    return oxlintDiagnostics(parsed(outcome.stdout, `oxlint's report (it wrote to stderr: ${outcome.stderr})`)).filter(
      (diagnostic) => diagnostic.code !== undefined && BOUNDARY_RULES.has(diagnostic.code),
    );
  } finally {
    await project.remove();
  }
}

/**
 * The diagnostics of one fixture.
 *
 * @param {readonly Diagnostic[]} found - The run's diagnostics.
 * @param {Fixture} fixture - The fixture.
 * @returns {readonly Diagnostic[]} Its diagnostics.
 */
function at(found: readonly Diagnostic[], fixture: Readonly<Fixture>): readonly Diagnostic[] {
  return found.filter((diagnostic) => diagnostic.file === fixture.path);
}

/**
 * Each import-boundary override of the configuration over a population: its files, and the member
 * packages each of its reasons refuses by name (the POC's and the climbs aside), reason by reason.
 *
 * @param {Population} held - The population.
 * @returns {readonly unknown[]} Each override's files and each reason's refused members.
 */
function bounded(held: Population): readonly unknown[] {
  return oxlintConfigOf(held).overrides.flatMap(({ files, rules }) => {
    const setting = rules['no-restricted-imports'];
    if (setting === undefined) {
      return [];
    }
    const options = object(list(setting, 'the setting').at(OPTIONS), 'its options');
    const paths = list(options['paths'], 'its paths').map((entry: unknown) => object(entry, 'its path'));
    const members = list(options['patterns'], 'its patterns')
      .map((pattern: unknown) => {
        const { message } = object(pattern, 'its pattern');
        return paths
          .filter((entry) => entry['message'] === message)
          .map((entry) => entry['name'])
          .filter((name) => typeof name === 'string' && name.startsWith('@p/'));
      })
      .filter((group: readonly unknown[]) => !isEmpty(group));
    return [[files, members]];
  });
}

export { at, boundaryDiagnostics, bounded };
