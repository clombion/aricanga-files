/**
 * The tasks of the repository's root `package.json`, read from the root manifest as the population
 * read it (`scope.ts`); the invocations of a tool a task makes; and a planted run's arguments, the
 * task's words with its own configuration file in place of the one the task names.
 */

import type { Task } from './config.ts';
import { population } from './scope.ts';
import { present } from './present.ts';
import { tasks } from './config.ts';

/**
 * The tasks of the repository's root `package.json`.
 *
 * @returns {Promise<ReadonlyMap<string, Task>>} Each task, by name.
 */
async function repoTasks(): Promise<ReadonlyMap<string, Task>> {
  const held = await population();
  return tasks(held.rootManifest);
}

/**
 * The invocations of a tool among some commands: each command whose first word is the tool's binary,
 * with the words after it.
 *
 * @param {readonly string[]} commands - The commands.
 * @param {string} binary - The tool's binary, the command's first word.
 * @returns {readonly (readonly string[])[]} Each invocation's arguments, in the commands' order.
 */
function runsOf(commands: readonly string[], binary: string): readonly (readonly string[])[] {
  return commands.flatMap((command) => {
    const [word, ...args] = command.split(' ');
    return word === binary ? [args] : [];
  });
}

/**
 * The invocations of a tool a task makes (`runsOf` over its commands).
 *
 * @param {string} task - The task's name.
 * @param {string} binary - The tool's binary.
 * @returns {Promise<readonly (readonly string[])[]>} Each invocation's arguments, in the task's order.
 */
async function toolRuns(task: string, binary: string): Promise<readonly (readonly string[])[]> {
  const found = await repoTasks();
  return runsOf(present(found.get(task), `the ${task} task`).commands, binary);
}

/**
 * The first invocation of a tool a task makes (`toolRuns`), refused when it makes none.
 *
 * @param {string} task - The task's name.
 * @param {string} binary - The tool's binary.
 * @returns {Promise<readonly string[]>} Its arguments.
 */
async function toolRun(task: string, binary: string): Promise<readonly string[]> {
  const [run] = await toolRuns(task, binary);
  return present(run, `the ${binary} command of the ${task} task`);
}

/**
 * A tool's arguments with the value of one flag replaced: a planted run makes the task's invocation
 * with its own configuration file.
 *
 * @param {readonly string[]} args - The task's arguments.
 * @param {string} flag - The flag whose value is replaced.
 * @param {string} value - The value in its place.
 * @returns {readonly string[]} The arguments.
 */
function substituted(args: readonly string[], flag: string, value: string): readonly string[] {
  const before = ['', ...args];
  return args.map((word, index) => (before[index] === flag ? value : word));
}

export { repoTasks, runsOf, substituted, toolRun, toolRuns };
