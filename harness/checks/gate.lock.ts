/** The lock check of the `gate` check: the task's command, run in a planted project. */

import { Project } from '#lib/tools.ts';
import { repoTasks } from '#lib/repo-tasks.ts';

const LOCK_CHECK = 'lock:check';

/**
 * A planted manifest pinning one dependency at `version`.
 *
 * @param {string} version - The version.
 * @returns {string} A planted manifest pinning one dependency at `version`.
 */
function manifest(version: string): string {
  return JSON.stringify({ devDependencies: { 'smol-toml': version }, name: 'plant', private: true, version: '0.0.0' });
}

/**
 * The lock-check task's command, split into its arguments.
 *
 * @returns {Promise<readonly string[]>} The command's arguments.
 */
async function lockCheckArguments(): Promise<readonly string[]> {
  const tasks = await repoTasks();
  const [command = ''] = tasks.get(LOCK_CHECK)?.commands ?? [];
  return command.split(' ');
}

/**
 * The status of a run of the lock check in a planted project after its lockfile is written for `written`
 * and its manifest moved to `current`.
 *
 * @param {string} written - The version the lockfile is written for.
 * @param {string} current - The version the manifest then pins.
 * @returns {Promise<{ readonly status: number; readonly outdated: boolean }>} The run's exit status and whether pnpm called the lockfile outdated.
 */
async function lockCheckAfter(written: string, current: string): Promise<{ readonly status: number; readonly outdated: boolean }> {
  const project = await Project.create({ linkModules: false });
  try {
    await project.write('package.json', manifest(written));
    await project.run('pnpm', 'install', '--lockfile-only', '--ignore-scripts');
    await project.write('package.json', manifest(current));
    const done = await project.run(...(await lockCheckArguments()));
    return { outdated: done.stdout.includes('ERR_PNPM_OUTDATED_LOCKFILE'), status: done.status };
  } finally {
    await project.remove();
  }
}

export { LOCK_CHECK, lockCheckAfter, lockCheckArguments };
