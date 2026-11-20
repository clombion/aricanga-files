/**
 * The project lint rules' fixtures and the planted lint run that proves them.
 *
 * A fixture is a text file `harness/lint-rules/fixtures/<rule>/<fire|clean>[-<case>].fixture` whose
 * first line is `// path: <where it is planted>`; the rest is the module's source. Kept as text, a
 * must-fire fixture is never linted, type-checked or scanned in the repository itself. The planted
 * run copies the repository's `.oxlintrc.json`, its TypeScript base and the plugin into a throwaway
 * project, writes every fixture at its path, and lints them all in one oxlint run.
 */

import { join } from 'node:path';

import { json, object } from './config.ts';
import { fromRoot } from './paths.ts';
import { textOf, tracked } from './source-files.ts';
import { bin, finished, Project } from './tools.ts';

export const FIXTURES_DIR = 'harness/lint-rules/fixtures/';

/**
 * What a planted project copies to run the repository's oxlint configuration: the config and the
 * project plugin it loads. Every check that plants an oxlint run copies exactly these.
 */
export const OXLINT_CONFIG_FILES: readonly string[] = ['.oxlintrc.json', 'harness/lint-rules'];
const FIXTURE_NAME = /^harness\/lint-rules\/fixtures\/([a-z-]+)\/(fire|clean)(-[a-z0-9-]+)?\.fixture$/;
const PATH_LINE = /^\/\/ path: (\S+)\n/;

export class FixtureError extends Error {
  override readonly name = 'FixtureError';
}

export interface Fixture {
  readonly file: string;
  readonly rule: string;
  readonly kind: 'fire' | 'clean';
  /** Where the fixture is planted, relative to the planted project's root. */
  readonly path: string;
  readonly source: string;
}

/** Parse one listed fixture file. */
export function parseFixture(file: string, text: string): Fixture {
  const name = FIXTURE_NAME.exec(file);
  const path = PATH_LINE.exec(text);
  const rule = name?.[1];
  const kind = name?.[2];
  if (rule === undefined || (kind !== 'fire' && kind !== 'clean')) {
    throw new FixtureError(`${file}: not named fixtures/<rule>/<fire|clean>[-<case>].fixture`);
  }
  if (path?.[1] === undefined) {
    throw new FixtureError(`${file}: the first line is not "// path: <where it is planted>"`);
  }
  return { file, rule, kind, path: path[1], source: text.slice(path[0].length) };
}

/** Every listed fixture. */
export function fixtures(): readonly Fixture[] {
  return tracked()
    .filter((file) => file.startsWith(FIXTURES_DIR))
    .map((file) => parseFixture(file, textOf(file)));
}

/** The rule folders under the fixtures directory, whatever their files are named. */
export function fixtureFolders(): readonly string[] {
  return [
    ...new Set(
      tracked()
        .filter((file) => file.startsWith(FIXTURES_DIR))
        .map((file) => file.slice(FIXTURES_DIR.length).split('/')[0] ?? ''),
    ),
  ].toSorted();
}

/** A diagnostic of the planted run: the rule code (`aricanga(env)`) and the planted file. */
export interface Diagnostic {
  readonly code: string;
  readonly file: string;
  readonly message: string;
}

/** Parse `oxlint --format json` output into diagnostics. */
export function diagnostics(output: string): readonly Diagnostic[] {
  const found = object(json(output), 'oxlint output').diagnostics;
  if (!Array.isArray(found)) {
    throw new FixtureError('oxlint output has no diagnostics array');
  }
  return found.map((entry: unknown) => {
    const fields = object(entry, 'diagnostic');
    return { code: String(fields.code), file: String(fields.filename), message: String(fields.message) };
  });
}

/** Where the workspace installs Solid: the characterisation package, its only consumer so far. */
const SOLID_HOME = fromRoot('packages', 'characterisation', 'node_modules');

/**
 * The tsconfig of the planted project: the repository's base, Solid's JSX, Node's types, and Solid's
 * packages mapped to where the workspace installs them, so the type-aware rules see real types.
 */
const PLANTED_TSCONFIG = JSON.stringify({
  extends: './tsconfig.base.json',
  compilerOptions: {
    jsx: 'preserve',
    jsxImportSource: '@solidjs/web',
    types: ['node'],
    paths: {
      'solid-js': [join(SOLID_HOME, 'solid-js', 'types', 'index.d.ts')],
      '@solidjs/web': [join(SOLID_HOME, '@solidjs', 'web', 'types', 'index.d.ts')],
      '@solidjs/web/jsx-runtime': [join(SOLID_HOME, '@solidjs', 'web', 'types', 'jsx.d.ts')],
    },
  },
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['node_modules', 'harness/lint-rules'],
});

/** Lint the given fixtures under the repository's oxlint configuration, in one run. */
export function lintFixtures(planted: readonly Fixture[]): readonly Diagnostic[] {
  const paths = planted.map((fixture) => fixture.path);
  const duplicate = paths.find((path, index) => paths.indexOf(path) !== index);
  if (duplicate !== undefined) {
    throw new FixtureError(`two fixtures are planted at ${duplicate}`);
  }
  const project = new Project({ copies: [...OXLINT_CONFIG_FILES, 'tsconfig.base.json'] });
  try {
    project.write('tsconfig.json', PLANTED_TSCONFIG);
    for (const fixture of planted) {
      project.write(fixture.path, fixture.source);
    }
    const outcome = finished([bin('oxlint'), '--format', 'json', ...paths], { cwd: project.root });
    if (outcome.stdout.trim() === '') {
      throw new FixtureError(`oxlint wrote no report: ${outcome.stderr}`);
    }
    return diagnostics(outcome.stdout).map((found) => ({
      code: found.code,
      message: found.message,
      file: found.file.replace(`${project.root}/`, ''),
    }));
  } finally {
    project.remove();
  }
}

/** The plugin rule codes the planted run reported on one planted path. */
export function codesAt(found: readonly Diagnostic[], path: string): readonly string[] {
  return found.filter((diagnostic) => diagnostic.file === path || diagnostic.file.endsWith(join('/', path))).map((d) => d.code);
}
