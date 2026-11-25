/** Runs of the locked oxlint over planted projects, for the `lint-settings` check. */

import { OXLINT_CONFIG_FILES, codeOf, oxlintDiagnostics } from '#lib/lint-rules.ts';
import { object, parsed } from '#lib/config.ts';
import { PLANTS } from './lint-settings.plants.ts';
import { Project } from '#lib/tools.ts';
import { textOf } from '#lib/source-files.ts';

type Options = Readonly<Record<string, unknown>>;

interface Lint {
  readonly status: number;
  readonly codes: ReadonlyMap<string, readonly string[]>;
}

/**
 * The repository's oxlint config, parsed.
 *
 * @returns {Promise<Options>} The config's top-level fields.
 */
async function repoConfig(): Promise<Options> {
  const text = await textOf('.oxlintrc.json');
  return object(parsed(text, '.oxlintrc.json'), '.oxlintrc.json');
}

/**
 * A copy of the repository's oxlint config with `options` merged over its options.
 *
 * @param {Options} options - Options to merge over the config's.
 * @param {Options} rules - Rule settings to merge over the config's.
 * @returns {Promise<string>} The config's text.
 */
async function config(options: Options, rules: Options = {}): Promise<string> {
  const repo = await repoConfig();
  return JSON.stringify({
    ...repo,
    options: { ...object(repo['options'] ?? {}, 'options'), ...options },
    rules: { ...object(repo['rules'] ?? {}, 'rules'), ...rules },
  });
}

/**
 * The rule codes of the JSON report of oxlint, by file.
 *
 * @param {unknown} report - The parsed report.
 * @returns {ReadonlyMap<string, readonly string[]>} Each file's distinct codes, sorted.
 */
function codesByFile(report: unknown): ReadonlyMap<string, readonly string[]> {
  const found = new Map<string, readonly string[]>();
  for (const diagnostic of oxlintDiagnostics(report)) {
    found.set(diagnostic.file, [...new Set([...(found.get(diagnostic.file) ?? []), codeOf(diagnostic)])].toSorted());
  }
  return found;
}

/**
 * One run of the locked oxlint over `files` in a planted project under `configText`.
 *
 * @param {Readonly<Record<string, string>>} files - Each planted file's text, by path.
 * @param {string} configText - The config the run reads.
 * @returns {Promise<Lint>} The run's exit status and codes.
 */
async function lint(files: Readonly<Record<string, string>>, configText: string): Promise<Lint> {
  const project = await Project.create({ copies: [...OXLINT_CONFIG_FILES, 'tsconfig.base.json'] });
  try {
    await project.write('.oxlintrc.json', configText);
    await project.write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { jsx: 'preserve', types: [] }, extends: './tsconfig.base.json', include: ['src'] }),
    );
    await project.writeAll(Object.entries(files));
    const done = await project.tool('oxlint', '-c', '.oxlintrc.json', '--format', 'json', ...Object.keys(files));
    return { codes: codesByFile(parsed(done.stdout, "oxlint's report")), status: done.status };
  } finally {
    await project.remove();
  }
}

/**
 * The codes oxlint reports for each plant, and the codes each plant expects.
 *
 * @returns {Promise<readonly [Options, Options]>} The reported and the expected codes, by plant.
 */
async function plantedCodes(): Promise<readonly [Options, Options]> {
  const planted = Object.entries(PLANTS);
  const texts = Object.fromEntries(planted.map(([path, [text]]: readonly [string, readonly [string, readonly string[]]]) => [path, text]));
  const run = await lint(texts, await config({}));
  const found = run.codes;
  return [
    Object.fromEntries(planted.map(([path]: readonly [string, unknown]) => [path, found.get(path) ?? []])),
    Object.fromEntries(planted.map(([path, [, codes]]: readonly [string, readonly [string, readonly string[]]]) => [path, codes])),
  ];
}

export type { Options };
export { config, lint, plantedCodes, repoConfig };
