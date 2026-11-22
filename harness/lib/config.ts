/** Reads the repository's tool configuration as typed records: the package tasks and the git hooks. */

import { textOf } from './source-files.ts';

/** A refusal of a configuration value of the wrong shape. */
class ConfigError extends Error {
  public override readonly name = 'ConfigError';
}

/** A task of the root `package.json`: its script split into the commands `&&` chains. */
interface Task {
  readonly name: string;
  readonly script: string;
  readonly commands: readonly string[];
}

/** A command of `lefthook.json`, with the hook it runs on. */
interface Hook {
  readonly hook: string;
  readonly id: string;
  readonly run: string;
  readonly useStdin: boolean;
}

/** A command that runs another task, capturing its name as `task`. */
const RUN = /^pnpm run (?<task>[\w:.-]+)$/u;

/**
 * A plain JSON object, or a refusal naming what it was instead.
 *
 * @param {unknown} value - The value to read as an object.
 * @param {string} what - What the value is, for the refusal.
 * @returns {Readonly<Record<string, unknown>>} The object's own entries.
 */
function object(value: unknown, what: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigError(`${what} is not an object: ${JSON.stringify(value)}`);
  }
  return Object.fromEntries(Object.entries(value));
}

/**
 * Parse JSON text into a value the readers narrow; never a typed cast.
 *
 * @param {string} text - The JSON text.
 * @returns {unknown} The parsed value.
 */
function json(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

/**
 * Parse a tool's JSON report, refusing text that is not JSON by naming the report.
 *
 * @param {string} text - The report's text.
 * @param {string} what - What the report is, for the refusal.
 * @returns {unknown} The parsed value.
 */
function report(text: string, what: string): unknown {
  try {
    return json(text);
  } catch (error: unknown) {
    throw new ConfigError(`${what} is not JSON: ${String(error)}`, { cause: error });
  }
}

/**
 * A JSON list, or a refusal naming what it was instead.
 *
 * @param {unknown} value - The value to read as a list.
 * @param {string} what - What the value is, for the refusal.
 * @returns {readonly unknown[]} The list's items.
 */
function list(value: unknown, what: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ConfigError(`${what} is not a list: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Every script of a parsed `package.json`, in the file's order.
 *
 * @param {unknown} packageJson - The parsed `package.json`.
 * @returns {ReadonlyMap<string, Task>} Each task, by name.
 */
function tasks(packageJson: unknown): ReadonlyMap<string, Task> {
  const scripts = object(object(packageJson, 'package.json')['scripts'] ?? {}, 'scripts');
  return new Map(
    Object.entries(scripts).map(([name, script]: readonly [string, unknown]) => {
      if (typeof script !== 'string') {
        throw new ConfigError(`script ${name} is not a string`);
      }
      const task: Task = { commands: script.split('&&').map((command) => command.trim()), name, script };
      return [name, task] as const;
    }),
  );
}

/**
 * Whether a command does nothing but run another task.
 *
 * @param {string} command - One command of a task's script.
 * @returns {boolean} Whether it is `pnpm run <task>`.
 */
function runsTask(command: string): boolean {
  return RUN.test(command);
}

/**
 * The tasks a task's commands `pnpm run`.
 *
 * @param {Task} task - The task.
 * @returns {readonly string[]} The names of the tasks it runs directly.
 */
function runs(task: Task): readonly string[] {
  return task.commands.flatMap((command) => {
    const name = RUN.exec(command)?.groups?.['task'];
    return name === undefined ? [] : [name];
  });
}

/**
 * The tasks `name` runs: itself and the tasks its commands `pnpm run`, transitively.
 *
 * @param {string} name - The task to start from.
 * @param {Readonly<ReadonlyMap<string, Task>>} every - Every task, by name.
 * @returns {readonly Task[]} The tasks reached, in the order they were first reached.
 */
function closure(name: string, every: Readonly<ReadonlyMap<string, Task>>): readonly Task[] {
  const seen = new Map<string, Task>();
  const pending = [name];
  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    const task = every.get(current);
    if (task === undefined) {
      throw new ConfigError(`no task named ${current}`);
    }
    if (!seen.has(current)) {
      seen.set(current, task);
      pending.push(...runs(task));
    }
  }
  return [...seen.values()];
}

/**
 * The tasks of the repository's root `package.json`.
 *
 * @returns {Promise<ReadonlyMap<string, Task>>} Each task, by name.
 */
async function repoTasks(): Promise<ReadonlyMap<string, Task>> {
  const text = await textOf('package.json');
  return tasks(json(text));
}

/**
 * Every command of a parsed `lefthook.json`.
 *
 * @param {unknown} lefthook - The parsed `lefthook.json`.
 * @returns {readonly Hook[]} Each command, with its hook.
 */
function hooks(lefthook: unknown): readonly Hook[] {
  return Object.entries(object(lefthook, 'lefthook.json')).flatMap(([hook, body]: readonly [string, unknown]) => {
    const commands = object(object(body, hook)['commands'] ?? {}, `${hook}.commands`);
    return Object.entries(commands).map(([id, command]: readonly [string, unknown]): Hook => {
      const fields = object(command, `${hook}.${id}`);
      const { run } = fields;
      if (typeof run !== 'string') {
        throw new ConfigError(`${hook}.${id}.run is not a string`);
      }
      return { hook, id, run, useStdin: fields['use_stdin'] === true };
    });
  });
}

/**
 * The hooks of the repository's `lefthook.json`.
 *
 * @returns {Promise<readonly Hook[]>} Each command, with its hook.
 */
async function repoHooks(): Promise<readonly Hook[]> {
  const text = await textOf('lefthook.json');
  return hooks(json(text));
}

export { closure, ConfigError, hooks, json, list, object, repoHooks, repoTasks, report, runsTask, tasks };
export type { Hook, Task };
