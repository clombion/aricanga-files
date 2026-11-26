/**
 * The one owner of the unused-code scan: knip, run the way the `deadcode` task runs it (production
 * mode, then default mode, each naming its configuration module and treating a configuration hint as
 * an error), at its strictest. Every issue type knip's schema names is an error, no file is excused
 * from an issue type (the configuration's type holds no such field), and each entry of the ignore
 * lists is held by the harness to a reason. knip hints a stale dependency or workspace ignore itself.
 * A planted run makes the task's invocations with its own configuration file (`planted`).
 */

import type { KnipConfig, PlantedKnipConfig } from './knip-config.ts';
import { Project, bin, finished } from './tools.ts';
import { object, parsed } from './config.ts';
import { substituted, toolRuns } from './repo-tasks.ts';
import type { Finished } from './process.ts';
import { inSequence } from './lists.ts';
import { knipConfig } from './config-modules.ts';
import { textOf } from './source-files.ts';

/**
 * The knip invocations of the `deadcode` task.
 *
 * @returns {Promise<readonly (readonly string[])[]>} Each invocation's arguments, without the binary.
 */
async function deadcodeRuns(): Promise<readonly (readonly string[])[]> {
  const runs = await toolRuns('deadcode', 'knip');
  return runs;
}

/** The configuration file of a planted knip run: JSON, which knip reads without loading a module. */
const PLANTED_KNIP_CONFIG = 'knip.json';

/** The flag that names knip's configuration file, followed by the file. */
const CONFIG_FLAG = '--config';

/**
 * A knip invocation of the task, as a planted run makes it: the same words, its configuration the
 * planted file in place of the one the task names.
 *
 * @param {readonly string[]} args - The task's arguments.
 * @returns {readonly string[]} The planted run's arguments.
 */
function planted(args: readonly string[]): readonly string[] {
  return substituted(args, CONFIG_FLAG, PLANTED_KNIP_CONFIG);
}

/**
 * Write a knip configuration into a planted project, as the file its knip run reads.
 *
 * @param {Readonly<Project>} project - The planted project.
 * @param {PlantedKnipConfig} config - The configuration, written as JSON.
 */
async function writeKnipConfig(project: Readonly<Project>, config: PlantedKnipConfig): Promise<void> {
  await project.write(PLANTED_KNIP_CONFIG, JSON.stringify(config));
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
 * Every ignore entry of the gate's knip configuration, as a key: `ignoreWorkspaces:<workspace>` or
 * `ignoreDependencies:<package>`; it holds no other ignore (`KnipConfig`).
 *
 * @param {Pick<KnipConfig, 'ignoreDependencies' | 'ignoreWorkspaces'>} config - The configuration's ignore lists.
 * @returns {readonly string[]} The entries' keys.
 */
function ignoreEntries(config: Pick<KnipConfig, 'ignoreDependencies' | 'ignoreWorkspaces'>): readonly string[] {
  return [
    ...config.ignoreWorkspaces.map((entry) => `ignoreWorkspaces:${entry}`),
    ...config.ignoreDependencies.map((entry) => `ignoreDependencies:${entry}`),
  ];
}

/**
 * The ignore entries of the configuration the repository's knip loads.
 *
 * @returns {Promise<readonly string[]>} The entries' keys.
 */
async function repoIgnoreEntries(): Promise<readonly string[]> {
  const config = await knipConfig();
  return ignoreEntries(config);
}

/**
 * The issue types knip's installed schema names.
 *
 * @returns {Promise<readonly string[]>} The issue types.
 */
async function issueTypes(): Promise<readonly string[]> {
  const text = await textOf('node_modules/knip/schema.json');
  const schema = object(parsed(text, 'knip schema'), 'knip schema');
  const rules = object(object(schema['properties'], 'properties')['rules'], 'rules');
  return Object.keys(object(rules['properties'], 'rules.properties'));
}

/**
 * What keeps a knip configuration's rules from knip's strictest setting: an issue type knip's
 * installed schema names that the rules do not set. The gate's type sets every issue type knip's own
 * type names, each at `error` (`KnipRules`); this holds those types against the schema knip runs by.
 *
 * @param {Readonly<Partial<Record<string, 'error'>>>} rules - The configuration's rules.
 * @param {readonly string[]} types - The issue types knip's schema names.
 * @returns {readonly string[]} Each problem.
 */
function strictnessProblems(rules: Readonly<Partial<Record<string, 'error'>>>, types: readonly string[]): readonly string[] {
  return types.filter((type) => !Object.hasOwn(rules, type)).map((type) => `rule ${type} is not set at error`);
}

/** A planted knip run: its exit status and output. */
interface Run {
  readonly status: number;
  readonly output: string;
}

/**
 * Every knip invocation of the deadcode task over a planted project of `files`, under `config`
 * written as its configuration: the one planted runner every check of knip uses.
 *
 * @param {readonly (readonly [string, string])[]} files - Each planted file's path and text, manifests included.
 * @param {PlantedKnipConfig} config - The configuration, written as JSON.
 * @returns {Promise<readonly Run[]>} Each run's exit status and output, in the task's order.
 */
async function plantedKnipRuns(files: readonly (readonly [string, string])[], config: PlantedKnipConfig): Promise<readonly Run[]> {
  const project = await Project.create();
  try {
    await writeKnipConfig(project, config);
    await project.writeAll(files);
    const runs = await deadcodeRuns();
    const done = await inSequence(runs, async (args) => {
      const run = await knip(project.root, planted(args));
      return { output: run.stdout + run.stderr, status: run.status };
    });
    return done;
  } finally {
    await project.remove();
  }
}

export { deadcodeRuns, ignoreEntries, issueTypes, knip, plantedKnipRuns, repoIgnoreEntries, strictnessProblems };
export type { Run };
