/**
 * The one owner of the unused-code scan: knip, run the way the `deadcode` task runs it (production
 * mode, then default mode, each treating a configuration hint as an error), at its strictest. Every
 * issue type knip's schema names is an error, no file is excused from an issue type, and each entry
 * of the remaining ignore lists is held by the harness to a reason. knip hints a stale dependency,
 * binary or workspace ignore itself.
 */

import { bin, finished } from './tools.ts';
import { json, object, repoTasks } from './config.ts';
import type { Finished } from './process.ts';
import { present } from './present.ts';
import { textOf } from './source-files.ts';

/** The ignore lists of `knip.json` that list plain entries. */
const LISTED_IGNORES: readonly string[] = ['ignoreWorkspaces', 'ignoreDependencies', 'ignoreBinaries', 'ignoreFiles'];

/** The words of a `knip` command after the binary's name. */
const AFTER_BINARY = 1;

/**
 * The knip invocations of the `deadcode` task.
 *
 * @returns {Promise<readonly (readonly string[])[]>} Each invocation's arguments, without the binary.
 */
async function deadcodeRuns(): Promise<readonly (readonly string[])[]> {
  const tasks = await repoTasks();
  const { commands } = present(tasks.get('deadcode'), 'the deadcode task');
  return commands.filter((command) => command.startsWith('knip')).map((command) => command.split(' ').slice(AFTER_BINARY));
}

/**
 * Run knip with `args` in `cwd`.
 *
 * @param {string} cwd - Where knip runs.
 * @param {readonly string[]} args - Its arguments.
 * @returns {Promise<Finished>} The finished run.
 */
async function knip(cwd: string, args: readonly string[]): Promise<Finished> {
  const done = await finished([bin('knip'), ...args, '--no-progress'], { cwd });
  return done;
}

/**
 * A list of strings, or a refusal naming what it was.
 *
 * @param {unknown} value - The value to read.
 * @param {string} what - What it is, for the refusal.
 * @returns {readonly string[]} The strings.
 */
function strings(value: unknown, what: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${what} is not a list of strings`);
  }
  return value.filter((item) => typeof item === 'string');
}

/**
 * Every ignore entry of a parsed `knip.json`, as a key: `ignoreWorkspaces:<workspace>`,
 * `ignoreDependencies:<package>`, `ignoreBinaries:<binary>`, `ignoreFiles:<glob>` or
 * `ignoreIssues:<glob>:<issue type>`.
 *
 * @param {unknown} config - The parsed `knip.json`.
 * @returns {readonly string[]} The entries' keys.
 */
function ignoreEntries(config: unknown): readonly string[] {
  const fields = object(config, 'knip.json');
  const listed = LISTED_IGNORES.flatMap((field) =>
    strings(Object.hasOwn(fields, field) ? fields[field] : [], field).map((entry) => `${field}:${entry}`),
  );
  const issues = Object.entries(object(fields['ignoreIssues'] ?? {}, 'ignoreIssues')).flatMap(([glob, types]: readonly [string, unknown]) =>
    strings(types, `ignoreIssues.${glob}`).map((type) => `ignoreIssues:${glob}:${type}`),
  );
  return [...listed, ...issues];
}

/**
 * The ignore entries of the repository's `knip.json`.
 *
 * @returns {Promise<readonly string[]>} The entries' keys.
 */
async function repoIgnoreEntries(): Promise<readonly string[]> {
  const text = await textOf('knip.json');
  return ignoreEntries(json(text));
}

/**
 * The issue types knip's installed schema names.
 *
 * @returns {Promise<readonly string[]>} The issue types.
 */
async function issueTypes(): Promise<readonly string[]> {
  const text = await textOf('node_modules/knip/schema.json');
  const schema = object(json(text), 'knip schema');
  const rules = object(object(schema['properties'], 'properties')['rules'], 'rules');
  return Object.keys(object(rules['properties'], 'rules.properties'));
}

/**
 * What keeps a parsed `knip.json` from knip's strictest setting: an issue type whose rule is not
 * `error`, or a file excused from an issue type (`ignoreIssues`, `ignoreFiles`).
 *
 * @param {unknown} config - The parsed `knip.json`.
 * @param {readonly string[]} types - The issue types knip names.
 * @returns {readonly string[]} Each problem.
 */
function strictnessProblems(config: unknown, types: readonly string[]): readonly string[] {
  const rules = object(object(config, 'knip.json')['rules'] ?? {}, 'rules');
  return [
    ...types.filter((type) => rules[type] !== 'error').map((type) => `rule ${type} is not error`),
    ...ignoreEntries(config)
      .filter((entry) => entry.startsWith('ignoreIssues:') || entry.startsWith('ignoreFiles:'))
      .map((entry) => `a file is excused: ${entry}`),
  ];
}

export { deadcodeRuns, ignoreEntries, issueTypes, knip, repoIgnoreEntries, strictnessProblems };
