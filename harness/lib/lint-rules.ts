/**
 * The project lint rules' fixtures and the planted lint run that proves them, and the reader of an
 * oxlint report (`oxlintDiagnostics`, `codeOf`) every planted oxlint run reads its findings with.
 *
 * A fixture is a text file `harness/lint-rules/fixtures/<rule>/<fire|clean>[-<case>].fixture` whose
 * first line is `// path: <where it is planted>`; the rest is the module's source. Kept as text, a
 * must-fire fixture is never linted, type-checked or scanned in the repository itself. The planted
 * run writes the repository's oxlint configuration (the value `oxlint.config.ts` loads) as the planted
 * project's JSON configuration (`writeOxlintConfig`), copies its TypeScript base and the plugin into a
 * throwaway project, writes every fixture at its path, and lints them all in one oxlint run.
 */

import { Project, bin, finished } from './tools.ts';
import { list, object, parsed, stringOf } from './config.ts';
import { textsOf, tracked } from './source-files.ts';
import { FixtureError } from './fixture-error.ts';
import { fromRoot } from './paths.ts';
import { oxlintConfig } from './config-modules.ts';
import path from 'node:path';

/** A rule fixture: the rule it proves, whether it must fire, where it is planted and its source. */
interface Fixture {
  readonly file: string;
  readonly rule: string;
  readonly kind: 'fire' | 'clean';
  /** Where the fixture is planted, relative to the planted project's root. */
  readonly path: string;
  readonly source: string;
}

/** A diagnostic of an oxlint report: its rule code (`aricanga(env)`), none for an unused directive; its file and its message. */
interface Diagnostic {
  readonly code: string | undefined;
  readonly file: string;
  readonly message: string;
}

/** The code `codeOf` gives an unused disable directive, which oxlint reports with no rule code. */
const UNUSED_DIRECTIVE = 'unused-disable-directive';

const FIXTURES_DIR = 'harness/lint-rules/fixtures/';

/**
 * What a planted project copies to run the repository's oxlint configuration: the project plugin it
 * loads. Every check that plants an oxlint run copies exactly these and writes the configuration
 * with `writeOxlintConfig`.
 */
const OXLINT_CONFIG_FILES: readonly string[] = ['harness/lint-rules'];

/** The configuration file of a planted oxlint run: JSON, which every oxlint runtime reads. */
const PLANTED_OXLINT_CONFIG = '.oxlintrc.json';
const FIXTURE_NAME = /^harness\/lint-rules\/fixtures\/(?<rule>[a-z-]+)\/(?<kind>fire|clean)(?:-[a-z0-9-]+)?\.fixture$/u;
const PATH_LINE = /^\/\/ path: (?<path>\S+)\n/u;

/** Where the workspace installs Solid for the planted lint project: the characterisation package's own install. */
const SOLID_HOME = fromRoot('packages', 'characterisation', 'node_modules');

/**
 * The tsconfig of the planted project: the repository's base, Solid's JSX, Node's types, and Solid's
 * packages mapped to where the workspace installs them, so the type-aware rules see real types.
 */
const PLANTED_TSCONFIG = JSON.stringify({
  compilerOptions: {
    jsx: 'preserve',
    jsxImportSource: '@solidjs/web',
    paths: {
      '@solidjs/web': [path.join(SOLID_HOME, '@solidjs', 'web', 'types', 'index.d.ts')],
      '@solidjs/web/jsx-runtime': [path.join(SOLID_HOME, '@solidjs', 'web', 'types', 'jsx.d.ts')],
      'solid-js': [path.join(SOLID_HOME, 'solid-js', 'types', 'index.d.ts')],
    },
    types: ['node'],
  },
  exclude: ['node_modules', 'harness/lint-rules'],
  extends: './tsconfig.base.json',
  include: ['**/*.ts', '**/*.tsx'],
});

/**
 * Parse one listed fixture file.
 *
 * @param {string} file - The fixture's repository-relative path.
 * @param {string} text - Its text.
 * @returns {Fixture} The fixture.
 */
function parseFixture(file: string, text: string): Fixture {
  const { kind, rule } = FIXTURE_NAME.exec(file)?.groups ?? {};
  if (rule === undefined || (kind !== 'fire' && kind !== 'clean')) {
    throw new FixtureError(`${file}: not named fixtures/<rule>/<fire|clean>[-<case>].fixture`);
  }
  const line = PATH_LINE.exec(text);
  const planted = line?.groups?.['path'];
  if (line === null || planted === undefined) {
    throw new FixtureError(`${file}: the first line is not "// path: <where it is planted>"`);
  }
  const [header] = line;
  return { file, kind, path: planted, rule, source: text.slice(header.length) };
}

/**
 * Every listed fixture.
 *
 * @returns {Promise<readonly Fixture[]>} The fixtures.
 */
async function fixtures(): Promise<readonly Fixture[]> {
  const listed = await tracked();
  const texts = await textsOf(listed.filter((file) => file.startsWith(FIXTURES_DIR)));
  return texts.map(([file, text]: readonly [string, string]) => parseFixture(file, text));
}

/**
 * The rule folders under the fixtures directory, whatever their files are named.
 *
 * @returns {Promise<readonly string[]>} The folders, sorted.
 */
async function fixtureFolders(): Promise<readonly string[]> {
  const listed = await tracked();
  const folders = listed
    .filter((file) => file.startsWith(FIXTURES_DIR))
    .map((file) => {
      const [folder = ''] = file.slice(FIXTURES_DIR.length).split('/');
      return folder;
    });
  return [...new Set(folders)].toSorted();
}

/**
 * The diagnostics of an `oxlint --format json` report, every reader's: a report with no `diagnostics`
 * is refused, and a diagnostic's `code` is absent where oxlint writes none (an unused directive).
 *
 * @param {unknown} output - The parsed report.
 * @returns {readonly Diagnostic[]} The diagnostics.
 */
function oxlintDiagnostics(output: unknown): readonly Diagnostic[] {
  return list(object(output, 'oxlint output')['diagnostics'], 'oxlint output diagnostics').map((entry: unknown) => {
    const fields = object(entry, 'diagnostic');
    return {
      code: fields['code'] === undefined ? undefined : stringOf(fields['code'], 'a diagnostic code'),
      file: stringOf(fields['filename'], 'a diagnostic filename'),
      message: stringOf(fields['message'], 'a diagnostic message'),
    };
  });
}

/**
 * A diagnostic's code: its rule code; `UNUSED_DIRECTIVE` for an unused directive, which carries none;
 * else `unrecognised: <message>`, a code no rule has, so a diagnostic of a kind this reader does not
 * know is never read as a rule's.
 *
 * @param {Diagnostic} diagnostic - The diagnostic.
 * @returns {string} Its code.
 */
function codeOf(diagnostic: Readonly<Diagnostic>): string {
  return diagnostic.code ?? (diagnostic.message.startsWith('Unused ') ? UNUSED_DIRECTIVE : `unrecognised: ${diagnostic.message}`);
}

/**
 * Write an oxlint configuration into a planted project, as the file its oxlint run reads.
 *
 * @param {Readonly<Project>} project - The planted project.
 * @param {object} config - The configuration; the repository's by default.
 */
async function writeOxlintConfig(project: Readonly<Project>, config?: object): Promise<void> {
  await project.write(PLANTED_OXLINT_CONFIG, JSON.stringify(config ?? (await oxlintConfig())));
}

/**
 * Refuse two fixtures planted at one path.
 *
 * @param {readonly string[]} paths - Where the fixtures are planted.
 */
function refuseDuplicates(paths: readonly string[]): void {
  const duplicate = paths.find((planted, index) => paths.indexOf(planted) !== index);
  if (duplicate !== undefined) {
    throw new FixtureError(`two fixtures are planted at ${duplicate}`);
  }
}

/**
 * Lint the planted fixtures of a project under its oxlint configuration.
 *
 * @param {Readonly<Project>} project - The planted project.
 * @param {readonly string[]} paths - Where the fixtures are planted.
 * @returns {Promise<readonly Diagnostic[]>} The diagnostics, with paths relative to the project.
 */
async function lintPlanted(project: Readonly<Project>, paths: readonly string[]): Promise<readonly Diagnostic[]> {
  const outcome = await finished([bin('oxlint'), '--format', 'json', ...paths], { cwd: project.root });
  return oxlintDiagnostics(parsed(outcome.stdout, `oxlint's report (it wrote to stderr: ${outcome.stderr})`)).map((found) => ({
    code: found.code,
    file: found.file.replace(`${project.root}/`, ''),
    message: found.message,
  }));
}

/**
 * Lint the given fixtures under the repository's oxlint configuration, in one run.
 *
 * @param {readonly Fixture[]} planted - The fixtures.
 * @returns {Promise<readonly Diagnostic[]>} The diagnostics.
 */
async function lintFixtures(planted: readonly Fixture[]): Promise<readonly Diagnostic[]> {
  const paths = planted.map((fixture) => fixture.path);
  refuseDuplicates(paths);
  const project = await Project.create({ copies: [...OXLINT_CONFIG_FILES, 'tsconfig.base.json'] });
  try {
    await project.write('tsconfig.json', PLANTED_TSCONFIG);
    await writeOxlintConfig(project);
    await project.writeAll(planted.map((fixture) => [fixture.path, fixture.source] as const));
    const found = await lintPlanted(project, paths);
    return found;
  } finally {
    await project.remove();
  }
}

/**
 * The plugin rule codes the planted run reported on one planted path.
 *
 * @param {readonly Diagnostic[]} found - The run's diagnostics.
 * @param {string} planted - The planted path.
 * @returns {readonly string[]} The codes reported there.
 */
function codesAt(found: readonly Diagnostic[], planted: string): readonly string[] {
  return found
    .filter((diagnostic) => diagnostic.file === planted || diagnostic.file.endsWith(path.join('/', planted)))
    .map((diagnostic) => codeOf(diagnostic));
}

export { FixtureError } from './fixture-error.ts';
export {
  codeOf,
  codesAt,
  fixtureFolders,
  fixtures,
  lintFixtures,
  OXLINT_CONFIG_FILES,
  oxlintDiagnostics,
  parseFixture,
  PLANTED_OXLINT_CONFIG,
  UNUSED_DIRECTIVE,
  writeOxlintConfig,
};
export type { Fixture };
