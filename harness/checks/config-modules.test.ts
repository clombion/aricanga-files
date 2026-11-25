/**
 * Each computed-config tool reads its configuration module and no rival file: every task that runs
 * the tool names the module after the tool's configuration flag, and the harness maps no root file
 * into its imports but the modules it loads typed.
 */

import { describe, expect, test } from 'vitest';
import { repoTasks, runsOf } from '#lib/repo-tasks.ts';
import { ROOT_CONFIG_MODULES } from '#lib/config-modules.ts';
import { object } from '#lib/config.ts';
import { population } from '#lib/scope.ts';

/** How many entries an empty list holds. */
const NONE = 0;

/** The word after a flag: its value. */
const VALUE = 1;

/**
 * The invocations of a tool (`runsOf`) that do not name its configuration module: no word after the
 * flag is the module.
 *
 * @param {readonly string[]} commands - The commands.
 * @param {readonly [string, string, string]} naming - The tool, its configuration flag and the module.
 * @returns {readonly (readonly string[])[]} The arguments of each invocation that names no module.
 */
function unnamed(commands: readonly string[], naming: readonly [string, string, string]): readonly (readonly string[])[] {
  const [tool, flag, module] = naming;
  return runsOf(commands, tool).filter((args) => !args.some((word, index) => word === flag && args[index + VALUE] === module));
}

describe('the repository', () => {
  test('every task names the configuration module of each computed-config tool it runs, so no rival file a tool would discover is read', async () => {
    expect.hasAssertions();
    const repoTaskMap = await repoTasks();
    const commands = [...repoTaskMap.values()].flatMap((task) => task.commands);
    expect([
      unnamed(commands, ['oxlint', '-c', ROOT_CONFIG_MODULES.oxlint]),
      unnamed(commands, ['knip', '--config', ROOT_CONFIG_MODULES.knip]),
      runsOf(commands, 'oxlint').length > NONE,
    ]).toStrictEqual([[], [], true]);
  });

  test("maps no root file into the harness's imports but the config modules it loads typed", async () => {
    expect.hasAssertions();
    const held = await population();
    const imports = Object.keys(object(held.rootManifest['imports'], 'imports')).filter((key) => key.startsWith('#root/'));
    expect(imports).toStrictEqual([`#root/${ROOT_CONFIG_MODULES.knip}`, `#root/${ROOT_CONFIG_MODULES.oxlint}`]);
  });
});

describe('the naming check', () => {
  test('sees a tool run naming another configuration module, or none, and no other tool', () => {
    expect.hasAssertions();
    const commands = ['oxlint -c oxlint.config.ts', 'oxlint -c oxlint.config.ts.old', 'oxlint', 'oxlintx -c other.json'];
    expect(unnamed(commands, ['oxlint', '-c', 'oxlint.config.ts'])).toStrictEqual([['-c', 'oxlint.config.ts.old'], []]);
  });
});
