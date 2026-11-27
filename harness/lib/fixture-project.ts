/**
 * The planted project the lint rules' fixtures run in: its tsconfig, and the compiler's errors on it.
 *
 * The tsconfig extends the repository's base with Solid's JSX and Node's types. It maps Solid's packages to the
 * characterisation package's install, and each member's name to its `.` export, read from the population: only the
 * `.` export, so a fixture importing a subpath a member does not export fails with `TS2307`, as a view's would. The
 * members' sources compile under this tsconfig, not their own project's; an error outside every fixture is reported.
 */

import { object, stringOf } from './config.ts';
import { FixtureError } from './fixture-error.ts';
import { HARNESS_LINT_RULES } from './test-globs.ts';
import type { Population } from './scope.ts';
import type { Project } from './tools.ts';
import { TYPESCRIPT } from './source-files.ts';
import { fromRoot } from './paths.ts';
import { isEmpty } from './lists.ts';
import path from 'node:path';
import { succeeded } from './exit-status.ts';

/** A compiler error: the file it is in, relative to the planted project (`''` for one tsc reports on no file), and its code. */
interface CompileError {
  readonly file: string;
  readonly code: string;
}

/** Where the planted project finds Solid's types: the characterisation package's install, which holds `@solidjs/web` too. */
const SOLID_HOME = fromRoot('packages', 'characterisation', 'node_modules');

/** One error line of `tsc --pretty false`: the file and its position, absent for an error on no file, then the code. */
const TSC_ERROR = /^(?:(?<file>[^\s(]+)\(\d+,\d+\): )?error (?<code>TS\d+):/gmu;

/**
 * The `.` export a manifest's `exports` field names: the field itself when it is a path, else its `.` entry when that is one.
 *
 * @param {unknown} field - The manifest's `exports`.
 * @returns {string | undefined} The path, relative to the member; none when the field names no `.` path.
 */
function dotExport(field: unknown): string | undefined {
  const entry = typeof field === 'object' && field !== null && Object.hasOwn(field, '.') ? object(field, "a member's exports")['.'] : field;
  return typeof entry === 'string' ? entry : undefined;
}

/**
 * Each named member's `.` export, as a tsconfig `paths` entry.
 *
 * @param {Population} held - The population.
 * @returns {Readonly<Record<string, readonly string[]>>} The entries, by member name.
 */
function memberPaths(held: Population): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    held.members.flatMap((member) => {
      const entry = dotExport(member.manifest['exports']);
      return member.name === undefined || entry === undefined ? [] : [[member.name, [fromRoot(member.dir, entry)]] as const];
    }),
  );
}

/**
 * The tsconfig of the planted fixtures' project, so the type-aware rules and the compiler see real types.
 *
 * @param {Population} held - The population whose members a fixture imports by name.
 * @returns {string} The tsconfig's text.
 */
function plantedTsconfig(held: Population): string {
  return JSON.stringify({
    compilerOptions: {
      jsx: 'preserve',
      jsxImportSource: '@solidjs/web',
      paths: {
        ...memberPaths(held),
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
}

/**
 * The errors of a finished `tsc` run. A run that failed with no error line read (it could not start, or wrote another
 * format) is refused, so a broken run never reads as a clean compile.
 *
 * @param {number} status - The run's exit status.
 * @param {string} stdout - What it wrote to stdout, where `tsc` writes its errors.
 * @param {string} stderr - What it wrote to stderr, for the refusal.
 * @returns {readonly CompileError[]} Its errors.
 */
function compileErrorsOf(status: number, stdout: string, stderr: string): readonly CompileError[] {
  const errors: CompileError[] = [];
  for (const match of stdout.matchAll(TSC_ERROR)) {
    const fields = object(match.groups, "a tsc error line's fields");
    errors.push({
      code: stringOf(fields['code'], "a tsc error's code"),
      file: fields['file'] === undefined ? '' : stringOf(fields['file'], "a tsc error's file"),
    });
  }
  if (!succeeded({ status }) && isEmpty(errors)) {
    throw new FixtureError(`tsc exited ${status} with no error read: ${stdout}${stderr}`);
  }
  return errors;
}

/**
 * Compile a planted project under its tsconfig.
 *
 * @param {Readonly<Project>} project - The planted project.
 * @returns {Promise<readonly CompileError[]>} The compiler's errors.
 */
async function compilePlanted(project: Readonly<Project>): Promise<readonly CompileError[]> {
  const done = await project.tool('tsc', '-p', 'tsconfig.json', '--pretty', 'false');
  return compileErrorsOf(done.status, done.stdout, done.stderr);
}

export { compileErrorsOf, compilePlanted, plantedTsconfig };
export type { CompileError };
