/**
 * A planted oxlint run: what it copies, the configuration it writes (`writeOxlintConfig`, the value
 * `oxlint.config.ts` loads, as the planted project's JSON configuration), the `lint` task's invocation
 * as it runs there, and the reader of an oxlint report (`oxlintDiagnostics`, `codeOf`) every planted
 * oxlint run reads its findings with. The lint rules' fixtures run through it (`lint-fixtures.ts`).
 */

import { bin, finished } from './tools.ts';
import { list, object, parsed, stringOf } from './config.ts';
import { substituted, toolRun } from './repo-tasks.ts';
import type { AnyOxlintConfig } from './oxlint-shape.ts';
import { HARNESS_LINT_RULES } from './test-globs.ts';
import type { Project } from './tools.ts';
import { oxlintConfig } from './config-modules.ts';

/**
 * A diagnostic of an oxlint report: its rule code (`aricanga(env)`), none for an unused directive; its
 * file, its message, and its help, none where oxlint writes none (a rule option's own message, such
 * as a `no-restricted-imports` pattern's, is the help).
 */
interface Diagnostic {
  readonly code: string | undefined;
  readonly file: string;
  readonly message: string;
  readonly help: string | undefined;
}

/** The code `codeOf` gives an unused disable directive, which oxlint reports with no rule code. */
const UNUSED_DIRECTIVE = 'unused-disable-directive';

/**
 * What a planted oxlint run copies: the plugin the configuration loads; a type-aware run copies the TypeScript base its
 * tsconfig extends too (`TYPED_OXLINT_CONFIG_FILES`). Every planted oxlint run copies one of the two, then `writeOxlintConfig`.
 */
const OXLINT_CONFIG_FILES: readonly string[] = [HARNESS_LINT_RULES];
const TYPED_OXLINT_CONFIG_FILES: readonly string[] = [...OXLINT_CONFIG_FILES, 'tsconfig.base.json'];

/** The configuration file of a planted oxlint run: JSON, which every oxlint runtime reads. */
const PLANTED_OXLINT_CONFIG = '.oxlintrc.json';

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
      help: fields['help'] === undefined ? undefined : stringOf(fields['help'], 'a diagnostic help'),
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
 * @param {AnyOxlintConfig} config - The configuration; the repository's by default.
 */
async function writeOxlintConfig(project: Readonly<Project>, config?: AnyOxlintConfig): Promise<void> {
  await project.write(PLANTED_OXLINT_CONFIG, JSON.stringify(config ?? (await oxlintConfig())));
}

/**
 * Lint the given paths of a planted project under its oxlint configuration.
 *
 * @param {Readonly<Project>} project - The planted project.
 * @param {readonly string[]} paths - The paths, relative to the project.
 * @returns {Promise<readonly Diagnostic[]>} The diagnostics, with paths relative to the project.
 */
async function lintPlanted(project: Readonly<Project>, paths: readonly string[]): Promise<readonly Diagnostic[]> {
  const outcome = await finished([bin('oxlint'), '--format', 'json', ...paths], { cwd: project.root });
  return oxlintDiagnostics(parsed(outcome.stdout, `oxlint's report (it wrote to stderr: ${outcome.stderr})`)).map((found) => ({
    code: found.code,
    file: found.file.replace(`${project.root}/`, ''),
    help: found.help,
    message: found.message,
  }));
}

/**
 * The oxlint invocation of the `lint` task: its arguments, without the binary.
 *
 * @returns {Promise<readonly string[]>} The arguments.
 */
async function lintRun(): Promise<readonly string[]> {
  const run = await toolRun('lint', 'oxlint');
  return run;
}

/**
 * The `lint` task's oxlint invocation as a planted run makes it: its `-c` file the planted one.
 *
 * @param {string} config - The planted configuration file; the one `writeOxlintConfig` writes by default.
 * @returns {Promise<readonly string[]>} The planted run's arguments.
 */
async function plantedLintRun(config: string = PLANTED_OXLINT_CONFIG): Promise<readonly string[]> {
  return substituted(await lintRun(), '-c', config);
}

/** What oxlint lists for a checkout: its exit status, and the files it would lint. */
interface Listing {
  readonly status: number;
  readonly files: readonly string[];
}

/**
 * The files oxlint lints in a checkout, as the `lint` task runs it (`--debug=files`: it lists, then exits).
 *
 * @param {string} cwd - The checkout.
 * @returns {Promise<Listing>} Its status and the files, relative to the checkout, sorted.
 */
async function lintedFiles(cwd: string): Promise<Listing> {
  const args = await lintRun();
  const done = await finished([bin('oxlint'), ...args, '--debug=files'], { cwd });
  return {
    files: done.stdout
      .split('\n')
      .filter((line) => line !== '')
      .toSorted(),
    status: done.status,
  };
}

export {
  codeOf,
  lintedFiles,
  lintPlanted,
  OXLINT_CONFIG_FILES,
  oxlintDiagnostics,
  plantedLintRun,
  TYPED_OXLINT_CONFIG_FILES,
  UNUSED_DIRECTIVE,
  writeOxlintConfig,
};
export type { Diagnostic };
