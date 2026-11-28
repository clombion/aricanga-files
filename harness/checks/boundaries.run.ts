/** The planted oxlint runs and config reads of the `boundaries` check. */

import { OXLINT_CONFIG_FILES, oxlintDiagnostics, plantedLintRun, writeOxlintConfig } from '#lib/lint-rules.ts';
import { list, object, parsed } from '#lib/config.ts';
import { Accepted } from '#lint-rules/exemptions.ts';
import { CLIMBS } from '#lib/import-boundaries.ts';
import type { Diagnostic } from '#lib/lint-rules.ts';
import type { Fixture } from './boundaries.plants.ts';
import type { Population } from '#lib/scope.ts';
import { Project } from '#lib/tools.ts';
import { isEmpty } from '#lib/lists.ts';
import { oxlintConfigOf } from '#lib/oxlint-config.ts';
import { population } from '#lib/scope.ts';

/** A rule setting's options, after its severity. */
const OPTIONS = 1;

/**
 * The rules the boundaries are: the role matrix's name lint and the restricted globals and properties,
 * and the form rules that refuse a specifier the name lint cannot read (a template, an import type,
 * a triple-slash path or types directive), so every literal specifier form is refused and counted.
 */
const BOUNDARY_RULES: Accepted<string> = new Accepted<string>([
  'aricanga(specifier)',
  'eslint(no-restricted-globals)',
  'eslint(no-restricted-imports)',
  'eslint(no-restricted-properties)',
  'typescript(consistent-type-imports)',
  'typescript(triple-slash-reference)',
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
 * The messages of each import-boundary override's refusals over a population, one per reason.
 *
 * @param {Population} held - The population.
 * @returns {readonly (readonly unknown[])[]} Each override's messages, in order.
 */
function reasonMessages(held: Population): readonly (readonly unknown[])[] {
  return oxlintConfigOf(held).overrides.flatMap(({ rules }) => {
    const setting = rules['no-restricted-imports'];
    return setting === undefined
      ? []
      : [
          list(object(list(setting, 'the setting').at(OPTIONS), 'its options')['patterns'], 'its patterns').map(
            (pattern: unknown) => object(pattern, 'its pattern')['message'],
          ),
        ];
  });
}

/**
 * Each import-boundary override of the configuration over a population: its files, and the member
 * packages each of its reasons refuses by name (the POC's and the climbs aside), reason by reason. A
 * reason's names are its paths with its pattern's message: an override's messages are distinct
 * (`reasonMessages`, held by the boundary test).
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

/** The code of the name lint's refusal. */
const NAME_LINT = 'eslint(no-restricted-imports)';

/**
 * The specifiers each glob refuses when it alone is the name lint's pattern: one planted module per
 * specifier, linted by oxlint under a configuration of that one glob.
 *
 * @param {readonly string[]} globs - The globs, each linted alone.
 * @param {readonly string[]} specifiers - The specifiers, each imported by a module of its own.
 * @returns {Promise<readonly (readonly string[])[]>} For each glob, the specifiers it refuses.
 */
async function refusedAlone(globs: readonly string[], specifiers: readonly string[]): Promise<readonly (readonly string[])[]> {
  const project = await Project.create();
  try {
    const modules = specifiers.map((specifier, index) => [`alone-${String(index)}.ts`, `export * from '${specifier}';\n`] as const);
    await project.writeAll(modules);
    return await Promise.all(
      globs.map(async (glob, index) => {
        const config = `alone-${String(index)}.json`;
        const pattern = { caseSensitive: true, group: [glob], message: glob };
        await project.write(config, JSON.stringify({ rules: { 'no-restricted-imports': ['error', { patterns: [pattern] }] } }));
        const outcome = await project.tool(
          'oxlint',
          ...(await plantedLintRun(config)),
          '--format',
          'json',
          ...modules.map(([file]) => file),
        );
        const files = new Set(
          oxlintDiagnostics(parsed(outcome.stdout, `oxlint's report (it wrote to stderr: ${outcome.stderr})`))
            .filter((diagnostic) => diagnostic.code === NAME_LINT)
            .map((diagnostic) => diagnostic.file),
        );
        return specifiers.filter((_specifier, place) => files.has(`alone-${String(place)}.ts`));
      }),
    );
  } finally {
    await project.remove();
  }
}

/**
 * What the climb globs refuse, each linted alone over the climb forms: the globs that refuse no form
 * another glob leaves, and the forms no glob refuses.
 *
 * @param {readonly string[]} forms - The climb forms.
 * @returns {Promise<Readonly<{ redundant: readonly string[]; unrefused: readonly string[] }>>} The redundant globs and the unrefused forms.
 */
async function climbsAlone(forms: readonly string[]): Promise<Readonly<{ redundant: readonly string[]; unrefused: readonly string[] }>> {
  const refused = await refusedAlone(CLIMBS, forms);
  const others = (glob: number): ReadonlySet<string> => new Set(refused.filter((_own, other) => other !== glob).flat());
  return {
    redundant: CLIMBS.filter((_glob, index) => (refused.at(index) ?? []).every((form) => others(index).has(form))),
    unrefused: forms.filter((form) => !refused.some((own) => own.includes(form))),
  };
}

/**
 * The messages of each import-boundary override over the repository's population.
 *
 * @returns {Promise<readonly (readonly unknown[])[]>} Each override's messages, in order.
 */
async function repositoryReasonMessages(): Promise<readonly (readonly unknown[])[]> {
  return reasonMessages(await population());
}

export { at, boundaryDiagnostics, bounded, climbsAlone, reasonMessages, repositoryReasonMessages };
