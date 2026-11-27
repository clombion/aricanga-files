/** Runs of the locked oxlint over planted projects, for the `lint-settings` check. */

import type { AnyOxlintConfig, GateOxlintConfig } from '#lib/oxlint-shape.ts';
import { TYPED_OXLINT_CONFIG_FILES, codeOf, oxlintDiagnostics, plantedLintRun, writeOxlintConfig } from '#lib/lint-rules.ts';
import type { NoOther } from '#lib/readonly.ts';
import { PLANTS } from './lint-settings.plants.ts';
import { Project } from '#lib/tools.ts';
import { oxlintConfig } from '#lib/config-modules.ts';
import { parsed } from '#lib/config.ts';

/** A config's rule settings or options, as plain values. */
type Options = Readonly<Record<string, unknown>>;

interface Lint {
  readonly status: number;
  readonly codes: ReadonlyMap<string, readonly string[]>;
}

/**
 * The repository's oxlint config, as oxlint loads it.
 *
 * @returns {Promise<GateOxlintConfig>} The config.
 */
async function repoConfig(): Promise<GateOxlintConfig> {
  const loaded = await oxlintConfig();
  return loaded;
}

/** What a planted lint config merges over the repository's: oxlint's options and rule settings, and no other field of its config. */
type Merged = Pick<AnyOxlintConfig, 'options' | 'rules'> & NoOther<AnyOxlintConfig, 'options' | 'rules'>;

/**
 * A copy of the repository's oxlint config with `merged`'s options merged over its options and its
 * rule settings over its rule settings; a field it would drop does not compile.
 *
 * @param {Merged} merged - The options and rule settings to merge over the config's.
 * @returns {Promise<AnyOxlintConfig>} The config.
 */
async function config(merged: Merged = {}): Promise<AnyOxlintConfig> {
  const repo = await repoConfig();
  return {
    ...repo,
    options: { ...repo.options, ...merged.options },
    rules: { ...repo.rules, ...merged.rules },
  };
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
 * @param {AnyOxlintConfig} planted - The config the run reads.
 * @returns {Promise<Lint>} The run's exit status and codes.
 */
async function lint(files: Readonly<Record<string, string>>, planted: AnyOxlintConfig): Promise<Lint> {
  const project = await Project.create({ copies: TYPED_OXLINT_CONFIG_FILES });
  try {
    await writeOxlintConfig(project, planted);
    await project.write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { jsx: 'preserve', types: [] }, extends: './tsconfig.base.json', include: ['src'] }),
    );
    await project.writeAll(Object.entries(files));
    const done = await project.tool('oxlint', ...(await plantedLintRun()), '--format', 'json', ...Object.keys(files));
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
  const run = await lint(texts, await config());
  const found = run.codes;
  return [
    Object.fromEntries(planted.map(([path]: readonly [string, unknown]) => [path, found.get(path) ?? []])),
    Object.fromEntries(planted.map(([path, [, codes]]: readonly [string, readonly [string, readonly string[]]]) => [path, codes])),
  ];
}

export type { Options };
export { config, lint, plantedCodes, repoConfig };
