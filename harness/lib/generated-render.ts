/**
 * The renderers of the docs' generated blocks: each turns what its owner reads into the block's
 * Markdown. `harness/lib/generated.ts` reads the inputs and names each renderer by its block.
 */

import type { CheckModule } from './checks.ts';
import { ConfigError } from './config.ts';
import type { Pin } from './pins.ts';
import type { Task } from './config.ts';

/** The first command of every task the gate runs through a tool: the lock check. */
const LOCK_FIRST = 'pnpm run lock:check';

/** The index of a task's first command. */
const FIRST = 0;

/**
 * The list of shipped checks.
 *
 * @param {readonly CheckModule[]} modules - The check modules, in order.
 * @returns {string} The list, as Markdown.
 */
function checkList(modules: readonly CheckModule[]): string {
  return modules.map((module) => `- \`${module.harnessId}\` (\`${module.path}\`): ${module.summary}`).join('\n');
}

/**
 * The table of pinned tools, with each tool's upstream repository.
 *
 * @param {readonly Pin[]} found - The pins.
 * @param {ReadonlyMap<string, string>} upstream - Each tool's repository, as owner and name.
 * @returns {string} The table, as Markdown.
 */
function pinTable(found: readonly Pin[], upstream: ReadonlyMap<string, string>): string {
  const rows = found.map((pin) => {
    const repository = upstream.get(pin.tool);
    if (repository === undefined) {
      throw new ConfigError(`no upstream repository is named for the pinned tool ${JSON.stringify(pin.tool)}`);
    }
    if (pin.version === undefined) {
      throw new ConfigError(`no version is pinned for ${JSON.stringify(pin.tool)} in ${pin.where.join(', ')}`);
    }
    return `| \`${pin.tool}\` | [${repository}](https://github.com/${repository}) | ${pin.where.map((input) => `\`${input}\``).join(', ')} | ${pin.version} |`;
  });
  return ['| Tool | Upstream | Pinned in | Pin |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

/**
 * The table of the harness's tasks: the entry points and every task that starts with the lock check.
 *
 * @param {readonly Task[]} tasks - The tasks, in the manifest's order.
 * @param {ReadonlySet<string>} entries - The tasks that run no tool themselves but are the gate's entry points.
 * @returns {string} The table, as Markdown.
 */
function taskTable(tasks: readonly Task[], entries: ReadonlySet<string>): string {
  const rows = tasks
    .filter((task) => entries.has(task.name) || task.commands.at(FIRST) === LOCK_FIRST)
    .map((task) => `| \`pnpm run ${task.name}\` | \`${task.script.replaceAll('|', String.raw`\|`)}\` |`);
  return ['| Command | Runs |', '| --- | --- |', ...rows].join('\n');
}

export { checkList, pinTable, taskTable };
