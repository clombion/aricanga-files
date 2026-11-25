/**
 * Reads JSON the harness is handed as typed records, one narrowing per boundary shape (`object`,
 * `list`, `strings`, `stringOf`, `stringRecord`; an absent field spelled once, `absentAs`, so JSON
 * `null` is refused where a list or an object is read): the repository's tool configuration (a
 * manifest's tasks, read from the population by `repo-tasks.ts`, and the git hooks), and the reports
 * of the tools it runs (pnpm's listing, Vitest's and jscpd's).
 */

import { textOf } from './source-files.ts';

/** A refusal of a configuration value, or a tool's report, of the wrong shape. */
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
 * JSON text parsed into a value the readers narrow, never a typed cast. Text that is not JSON
 * refuses with `ConfigError` naming what it is: every parse names its source.
 *
 * @param {string} text - The JSON text.
 * @param {string} what - What the text is, for the refusal.
 * @returns {unknown} The parsed value.
 */
function parsed(text: string, what: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch (error: unknown) {
    throw new ConfigError(`${what} is not JSON: ${String(error)}`, { cause: error });
  }
}

/**
 * A string field of a value read from outside, or a refusal naming what it was instead.
 *
 * @param {unknown} value - The field's value.
 * @param {string} what - What the field is, for the refusal.
 * @returns {string} The string.
 */
function stringOf(value: unknown, what: string): string {
  if (typeof value !== 'string') {
    throw new ConfigError(`${what} is not a string: ${JSON.stringify(value)}`);
  }
  return value;
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
 * A field as its reader takes it, its absence spelled once: a field not written (`undefined`) reads
 * as `absent`; any other value, JSON `null` included, is passed on as written for the caller to
 * narrow, so `null` is refused where a list or an object is read.
 *
 * @param {unknown} value - The field's value.
 * @param {unknown} absent - What an absent field reads as.
 * @returns {unknown} The value, or `absent`.
 */
function absentAs(value: unknown, absent: unknown): unknown {
  return value === undefined ? absent : value;
}

/**
 * A JSON list of strings, or a refusal naming the field, or the item, that is not one.
 *
 * @param {unknown} value - The value to read.
 * @param {string} what - What the value is, for the refusal.
 * @returns {readonly string[]} The strings.
 */
function strings(value: unknown, what: string): readonly string[] {
  return list(value, what).map((item, index) => stringOf(item, `${what}[${index}]`));
}

/**
 * A JSON object whose values are strings, or a refusal naming the field, or the entry, that is not one.
 *
 * @param {unknown} value - The value to read.
 * @param {string} what - What the value is, for the refusal.
 * @returns {Readonly<Record<string, string>>} The entries.
 */
function stringRecord(value: unknown, what: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(object(value, what)).map(
      ([key, entry]: readonly [string, unknown]) => [key, stringOf(entry, `${what}.${key}`)] as const,
    ),
  );
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
    Object.entries(stringRecord(scripts, 'scripts')).map(([name, script]: readonly [string, string]) => {
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
      return { hook, id, run: stringOf(fields['run'], `${hook}.${id}.run`), useStdin: fields['use_stdin'] === true };
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
  return hooks(parsed(text, 'lefthook.json'));
}

export { absentAs, closure, ConfigError, hooks, list, object, parsed, repoHooks, runsTask, stringOf, stringRecord, strings, tasks };
export type { Hook, Task };
