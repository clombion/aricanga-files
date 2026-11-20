/** Runs of the locked oxlint over planted projects, for the `lint-settings` check. */

import { PLANTS, UNUSED_DIRECTIVE } from './lint-settings.plants.ts';
import { json, object } from '#lib/config.ts';
import { OXLINT_CONFIG_FILES } from '#lib/lint-rules.ts';
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
 * @returns {Options} The config's top-level fields.
 */
function repoConfig(): Options {
  return object(json(textOf('.oxlintrc.json')), '.oxlintrc.json');
}

/**
 * A copy of the repository's oxlint config with `options` merged over its options.
 *
 * @param {Options} options - Options to merge over the config's.
 * @param {Options} rules - Rule settings to merge over the config's.
 * @returns {string} The config's text.
 */
function config(options: Options, rules: Options = {}): string {
  const repo = repoConfig();
  return JSON.stringify({
    ...repo,
    options: { ...object(repo['options'] ?? {}, 'options'), ...options },
    rules: { ...object(repo['rules'] ?? {}, 'rules'), ...rules },
  });
}

/**
 * The text of one field of a diagnostic, or `''`.
 *
 * @param {Options} fields - The diagnostic.
 * @param {string} name - The field.
 * @returns {string} The field's text.
 */
function field(fields: Options, name: string): string {
  const value = fields[name];
  return typeof value === 'string' ? value : '';
}

/**
 * The code of one diagnostic: its rule code, or `UNUSED_DIRECTIVE` for an unused directive.
 *
 * @param {Options} fields - The diagnostic.
 * @returns {string} The diagnostic's code.
 */
function codeOf(fields: Options): string {
  const code = field(fields, 'code');
  if (code !== '') {
    return code;
  }
  const message = field(fields, 'message');
  return message.startsWith('Unused ') ? UNUSED_DIRECTIVE : message;
}

/**
 * The rule codes of the JSON report of oxlint, by file.
 *
 * @param {unknown} report - The parsed report.
 * @returns {ReadonlyMap<string, readonly string[]>} Each file's distinct codes, sorted.
 */
function codesByFile(report: unknown): ReadonlyMap<string, readonly string[]> {
  const { diagnostics } = object(report, 'oxlint report');
  const found = new Map<string, readonly string[]>();
  for (const entry of Array.isArray(diagnostics) ? diagnostics : []) {
    const fields = object(entry, 'diagnostic');
    const file = field(fields, 'filename');
    found.set(file, [...new Set([...(found.get(file) ?? []), codeOf(fields)])].toSorted());
  }
  return found;
}

/**
 * One run of the locked oxlint over `files` in a planted project under `configText`.
 *
 * @param {Readonly<Record<string, string>>} files - Each planted file's text, by path.
 * @param {string} configText - The config the run reads.
 * @returns {Lint} The run's exit status and codes.
 */
function lint(files: Readonly<Record<string, string>>, configText: string): Lint {
  const project = new Project({ copies: [...OXLINT_CONFIG_FILES, 'tsconfig.base.json'] });
  try {
    project.write('.oxlintrc.json', configText);
    project.write('tsconfig.json', JSON.stringify({ compilerOptions: { jsx: 'preserve', types: [] }, extends: './tsconfig.base.json', include: ['src'] }));
    for (const [path, text] of Object.entries(files)) {
      project.write(path, text);
    }
    const done = project.tool('oxlint', '-c', '.oxlintrc.json', '--format', 'json', ...Object.keys(files));
    return { codes: codesByFile(json(done.stdout)), status: done.status };
  } finally {
    project.remove();
  }
}

/**
 * The codes oxlint reports for each plant, and the codes each plant expects.
 *
 * @returns {readonly [Options, Options]} The reported and the expected codes, by plant.
 */
function plantedCodes(): readonly [Options, Options] {
  const planted = Object.entries(PLANTS);
  const texts = Object.fromEntries(planted.map(([path, [text]]: readonly [string, readonly [string, readonly string[]]]) => [path, text]));
  const found = lint(texts, config({})).codes;
  return [
    Object.fromEntries(planted.map(([path]: readonly [string, unknown]) => [path, found.get(path) ?? []])),
    Object.fromEntries(planted.map(([path, [, codes]]: readonly [string, readonly [string, readonly string[]]]) => [path, codes])),
  ];
}

export type { Options };
export { config, lint, plantedCodes, repoConfig };
