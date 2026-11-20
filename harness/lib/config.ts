/** Reads the repository's tool configuration as typed records: the package tasks and the git hooks. */

import { textOf } from './source-files.ts';

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/** A plain JSON object, or a refusal naming what it was instead. */
export function object(value: unknown, what: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigError(`${what} is not an object: ${JSON.stringify(value)}`);
  }
  return Object.fromEntries(Object.entries(value));
}

/** Parse JSON text into a value the readers narrow; never a typed cast. */
export function json(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

/** A task of the root `package.json`: its script split into the commands `&&` chains. */
export interface Task {
  readonly name: string;
  readonly script: string;
  readonly commands: readonly string[];
}

/** Every script of a parsed `package.json`, by name, in the file's order. */
export function tasks(packageJson: unknown): ReadonlyMap<string, Task> {
  const scripts = object(object(packageJson, 'package.json')['scripts'] ?? {}, 'scripts');
  const found = new Map<string, Task>();
  for (const [name, script] of Object.entries(scripts)) {
    if (typeof script !== 'string') {
      throw new ConfigError(`script ${name} is not a string`);
    }
    found.set(name, { name, script, commands: script.split('&&').map((command) => command.trim()) });
  }
  return found;
}

/** A command that runs another task, capturing its name. */
export const RUN: RegExp = /^pnpm run ([\w:.-]+)$/;

/** The tasks `name` runs: itself and the tasks its commands `pnpm run`, transitively. */
export function closure(name: string, every: ReadonlyMap<string, Task>): readonly Task[] {
  const seen = new Map<string, Task>();
  const pending = [name];
  while (pending.length > 0) {
    const current = pending.pop() ?? '';
    const task = every.get(current);
    if (task === undefined) {
      throw new Error(`no task named ${current}`);
    }
    if (!seen.has(current)) {
      seen.set(current, task);
      pending.push(...task.commands.flatMap((command) => RUN.exec(command)?.slice(1, 2) ?? []));
    }
  }
  return [...seen.values()];
}

/** The tasks of the repository's root `package.json`. */
export function repoTasks(): ReadonlyMap<string, Task> {
  return tasks(json(textOf('package.json')));
}

/** A command of `lefthook.json`, with the hook it runs on. */
export interface Hook {
  readonly hook: string;
  readonly id: string;
  readonly run: string;
  readonly useStdin: boolean;
}

/** Every command of a parsed `lefthook.json`. */
export function hooks(lefthook: unknown): readonly Hook[] {
  const found: Hook[] = [];
  for (const [hook, body] of Object.entries(object(lefthook, 'lefthook.json'))) {
    const commands = object(object(body, hook)['commands'] ?? {}, `${hook}.commands`);
    for (const [id, command] of Object.entries(commands)) {
      const fields = object(command, `${hook}.${id}`);
      if (typeof fields['run'] !== 'string') {
        throw new ConfigError(`${hook}.${id}.run is not a string`);
      }
      found.push({ hook, id, run: fields['run'], useStdin: fields['use_stdin'] === true });
    }
  }
  return found;
}

/** The hooks of the repository's `lefthook.json`. */
export function repoHooks(): readonly Hook[] {
  return hooks(json(textOf('lefthook.json')));
}
