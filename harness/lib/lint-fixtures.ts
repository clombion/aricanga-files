/**
 * The project lint rules' fixtures and the planted lint run that proves them.
 *
 * A fixture is a text file `harness/lint-rules/fixtures/<rule>/<fire|clean>[-<case>].fixture` whose
 * first line is `// path: <where it is planted>`; the rest is the module's source. Kept as text, a
 * must-fire fixture is never linted, type-checked or scanned in the repository itself. The planted
 * run writes the repository's oxlint configuration as the planted project's JSON configuration
 * (`writeOxlintConfig`), copies its TypeScript base and the plugin into a throwaway project, writes
 * every fixture at its path, and lints them all in one oxlint run.
 */

import { TYPED_OXLINT_CONFIG_FILES, codeOf, lintPlanted, writeOxlintConfig } from './lint-rules.ts';
import { TYPESCRIPT, textsOf, tracked } from './source-files.ts';
import type { Diagnostic } from './lint-rules.ts';
import { FixtureError } from './fixture-error.ts';
import { HARNESS_LINT_RULES } from './test-globs.ts';
import { Project } from './tools.ts';
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

const FIXTURES_DIR = `${HARNESS_LINT_RULES}fixtures/`;
const FIXTURE_NAME = new RegExp(
  String.raw`^${FIXTURES_DIR.replaceAll('/', String.raw`\/`)}(?<rule>[a-z-]+)\/(?<kind>fire|clean)(?:-[a-z0-9-]+)?\.fixture$`,
  'u',
);
const PATH_LINE = /^\/\/ path: (?<path>\S+)\n/u;

/** Where the planted lint project finds Solid's types: the characterisation package's install, which holds `@solidjs/web` too. */
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
  exclude: ['node_modules', HARNESS_LINT_RULES],
  extends: './tsconfig.base.json',
  include: [...TYPESCRIPT].map((suffix) => `**/*${suffix}`),
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
 * Lint the given fixtures under the repository's oxlint configuration, in one run.
 *
 * @param {readonly Fixture[]} planted - The fixtures.
 * @returns {Promise<readonly Diagnostic[]>} The diagnostics.
 */
async function lintFixtures(planted: readonly Fixture[]): Promise<readonly Diagnostic[]> {
  const paths = planted.map((fixture) => fixture.path);
  refuseDuplicates(paths);
  const project = await Project.create({ copies: TYPED_OXLINT_CONFIG_FILES });
  try {
    await project.write('tsconfig.json', PLANTED_TSCONFIG);
    await writeOxlintConfig(project);
    await project.writeAll(planted.map((fixture) => [fixture.path, fixture.source] as const));
    return await lintPlanted(project, paths);
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
export { codesAt, fixtureFolders, fixtures, lintFixtures, parseFixture };
export type { Fixture };
