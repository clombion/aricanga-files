/**
 * The project lint rules' fixtures and the planted run that proves them.
 *
 * A fixture is a text file `harness/lint-rules/fixtures/<rule>/<fire|clean>[-<case>].fixture` whose
 * first line is `// path: <where it is planted>`; a second line `// tsc: <codes>` names the compiler
 * errors its source has on purpose (`// tsc: TS2322`), none for most; the rest is the module's source.
 * Kept as text, a must-fire fixture is never linted, type-checked or scanned in the repository
 * itself, only in the planted run: it writes the repository's oxlint configuration as the planted
 * project's JSON configuration (`writeOxlintConfig`) and its tsconfig (`fixture-project.ts`), copies the
 * TypeScript base and the plugin into a throwaway project, writes every fixture at its path, and runs
 * oxlint and `tsc` over them once each. A fixture holds when its compiler errors are exactly the codes
 * it declares (`compileProblems`); the codes are compared, not where each error is.
 */

import { TYPED_OXLINT_CONFIG_FILES, codeOf, lintPlanted, writeOxlintConfig } from './lint-rules.ts';
import { compilePlanted, plantedTsconfig } from './fixture-project.ts';
import { textsOf, tracked } from './source-files.ts';
import type { CompileError } from './fixture-project.ts';
import type { Diagnostic } from './lint-rules.ts';
import { FixtureError } from './fixture-error.ts';
import { HARNESS_LINT_RULES } from './test-globs.ts';
import { Project } from './tools.ts';
import path from 'node:path';
import { population } from './scope.ts';

/** A rule fixture: the rule it proves, whether it must fire, where it is planted, the compiler errors it declares and its source. */
interface Fixture {
  readonly file: string;
  readonly rule: string;
  readonly kind: 'fire' | 'clean';
  /** Where the fixture is planted, relative to the planted project's root. */
  readonly path: string;
  /** The codes of the compiler errors its source has on purpose, from its `// tsc:` line; none for most. */
  readonly errors: readonly string[];
  readonly source: string;
}

/** What one planted run of the fixtures found: oxlint's diagnostics and the compiler's errors. */
interface Run {
  readonly lint: readonly Diagnostic[];
  readonly compiled: readonly CompileError[];
}

const FIXTURES_DIR = `${HARNESS_LINT_RULES}fixtures/`;
const FIXTURE_NAME = new RegExp(
  String.raw`^${FIXTURES_DIR.replaceAll('/', String.raw`\/`)}(?<rule>[a-z-]+)\/(?<kind>fire|clean)(?:-[a-z0-9-]+)?\.fixture$`,
  'u',
);
const HEADER = /^\/\/ path: (?<path>\S+)\n(?:\/\/ tsc: (?<errors>TS\d+(?: TS\d+)*)\n)?/u;

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
  const line = HEADER.exec(text);
  const planted = line?.groups?.['path'];
  if (line === null || planted === undefined) {
    throw new FixtureError(`${file}: the first line is not "// path: <where it is planted>"`);
  }
  const [header] = line;
  const errors = line.groups?.['errors']?.split(' ') ?? [];
  return { errors, file, kind, path: planted, rule, source: text.slice(header.length) };
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
 * Lint and compile the given fixtures in one planted project, under the repository's oxlint configuration.
 *
 * @param {readonly Fixture[]} planted - The fixtures.
 * @returns {Promise<Run>} oxlint's diagnostics and the compiler's errors, with paths relative to the project.
 */
async function runFixtures(planted: readonly Fixture[]): Promise<Run> {
  const paths = planted.map((fixture) => fixture.path);
  refuseDuplicates(paths);
  const [project, held] = await Promise.all([Project.create({ copies: TYPED_OXLINT_CONFIG_FILES }), population()]);
  try {
    await Promise.all([project.write('tsconfig.json', plantedTsconfig(held)), writeOxlintConfig(project)]);
    await project.writeAll(planted.map((fixture) => [fixture.path, fixture.source] as const));
    const [lint, compiled] = await Promise.all([lintPlanted(project, paths), compilePlanted(project)]);
    return { compiled, lint };
  } finally {
    await project.remove();
  }
}

/**
 * The codes, sorted, of the compiler errors in one planted file.
 *
 * @param {readonly CompileError[]} compiled - The run's compiler errors.
 * @param {string} file - The planted path.
 * @returns {string} The codes, space-separated; empty for none.
 */
function codesIn(compiled: readonly CompileError[], file: string): string {
  return compiled
    .filter((error) => error.file === file)
    .map((error) => error.code)
    .toSorted()
    .join(' ');
}

/**
 * Each fixture whose compiler errors are not exactly the codes it declares, as `<fixture>: compiles to <codes>, declares
 * <codes>` (`none` for no code), and each compiler error in no fixture's file, as `<file>: <code>, in no fixture`.
 *
 * @param {readonly Fixture[]} planted - The fixtures of the run.
 * @param {readonly CompileError[]} compiled - The run's compiler errors.
 * @returns {readonly string[]} The problems; none when every fixture compiles as it declares.
 */
function compileProblems(planted: readonly Fixture[], compiled: readonly CompileError[]): readonly string[] {
  const unheld = planted.flatMap((fixture) => {
    const found = codesIn(compiled, fixture.path);
    const declared = fixture.errors.toSorted().join(' ');
    return found === declared ? [] : [`${fixture.file}: compiles to ${found || 'none'}, declares ${declared || 'none'}`];
  });
  const outside = compiled
    .filter((error) => !planted.some((fixture) => fixture.path === error.file))
    .map((error) => `${error.file}: ${error.code}, in no fixture`);
  return [...unheld, ...outside];
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
export { codesAt, compileProblems, fixtureFolders, fixtures, parseFixture, runFixtures };
export type { Fixture };
