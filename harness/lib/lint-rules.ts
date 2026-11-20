/**
 * The project lint rules' fixtures and the planted lint run that proves them.
 *
 * A fixture is a text file `harness/lint-rules/fixtures/<rule>/<fire|clean>[-<case>].fixture` whose
 * first line is `// path: <where it is planted>`; the rest is the module's source. Kept as text, a
 * must-fire fixture is never linted, type-checked or scanned in the repository itself. The planted
 * run copies the repository's `.oxlintrc.json`, its TypeScript base and the plugin into a throwaway
 * project, writes every fixture at its path, and lints them all in one oxlint run.
 */

import { Project, bin, finished } from './tools.ts';
import { json, object } from './config.ts';
import { textOf, tracked } from './source-files.ts';

import { FixtureError } from './fixture-error.ts';
import { fromRoot } from './paths.ts';
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

/** A diagnostic of the planted run: the rule code (`aricanga(env)`) and the planted file. */
interface Diagnostic {
  readonly code: string;
  readonly file: string;
  readonly message: string;
}

const FIXTURES_DIR = 'harness/lint-rules/fixtures/';

/**
 * What a planted project copies to run the repository's oxlint configuration: the config and the
 * project plugin it loads. Every check that plants an oxlint run copies exactly these.
 */
const OXLINT_CONFIG_FILES: readonly string[] = ['.oxlintrc.json', 'harness/lint-rules'];
const FIXTURE_NAME = /^harness\/lint-rules\/fixtures\/(?<rule>[a-z-]+)\/(?<kind>fire|clean)(?:-[a-z0-9-]+)?\.fixture$/u;
const PATH_LINE = /^\/\/ path: (?<path>\S+)\n/u;

/** Where the workspace installs Solid: the characterisation package, its only consumer so far. */
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
 * @returns {readonly Fixture[]} The fixtures.
 */
function fixtures(): readonly Fixture[] {
  return tracked()
    .filter((file) => file.startsWith(FIXTURES_DIR))
    .map((file) => parseFixture(file, textOf(file)));
}

/**
 * The rule folders under the fixtures directory, whatever their files are named.
 *
 * @returns {readonly string[]} The folders, sorted.
 */
function fixtureFolders(): readonly string[] {
  const folders = tracked()
    .filter((file) => file.startsWith(FIXTURES_DIR))
    .map((file) => {
      const [folder = ''] = file.slice(FIXTURES_DIR.length).split('/');
      return folder;
    });
  return [...new Set(folders)].toSorted();
}

/**
 * Parse `oxlint --format json` output into diagnostics.
 *
 * @param {string} output - The output.
 * @returns {readonly Diagnostic[]} The diagnostics.
 */
function diagnostics(output: string): readonly Diagnostic[] {
  const found = object(json(output), 'oxlint output')['diagnostics'];
  if (!Array.isArray(found)) {
    throw new FixtureError('oxlint output has no diagnostics array');
  }
  return found.map((entry: unknown) => {
    const fields = object(entry, 'diagnostic');
    return { code: String(fields['code']), file: String(fields['filename']), message: String(fields['message']) };
  });
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
 * @returns {readonly Diagnostic[]} The diagnostics, with paths relative to the project.
 */
function lintPlanted(project: Readonly<Project>, paths: readonly string[]): readonly Diagnostic[] {
  const outcome = finished([bin('oxlint'), '--format', 'json', ...paths], { cwd: project.root });
  if (outcome.stdout.trim() === '') {
    throw new FixtureError(`oxlint wrote no report: ${outcome.stderr}`);
  }
  return diagnostics(outcome.stdout).map((found) => ({
    code: found.code,
    file: found.file.replace(`${project.root}/`, ''),
    message: found.message,
  }));
}

/**
 * Lint the given fixtures under the repository's oxlint configuration, in one run.
 *
 * @param {readonly Fixture[]} planted - The fixtures.
 * @returns {readonly Diagnostic[]} The diagnostics.
 */
function lintFixtures(planted: readonly Fixture[]): readonly Diagnostic[] {
  const paths = planted.map((fixture) => fixture.path);
  refuseDuplicates(paths);
  const project = new Project({ copies: [...OXLINT_CONFIG_FILES, 'tsconfig.base.json'] });
  try {
    project.write('tsconfig.json', PLANTED_TSCONFIG);
    for (const fixture of planted) {
      project.write(fixture.path, fixture.source);
    }
    return lintPlanted(project, paths);
  } finally {
    project.remove();
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
    .map((diagnostic) => diagnostic.code);
}

export { FixtureError } from './fixture-error.ts';
export { codesAt, fixtureFolders, fixtures, lintFixtures, OXLINT_CONFIG_FILES, parseFixture };
export type { Fixture };
