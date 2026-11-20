/** The lock check of the `gate` check: the task's command, run in a planted project. */

import { Project } from '#lib/tools.ts';
import { repoTasks } from '#lib/config.ts';

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
 * @returns {readonly string[]} The command's arguments.
 */
function lockCheckArguments(): readonly string[] {
  const [command = ''] = repoTasks().get(LOCK_CHECK)?.commands ?? [];
  return command.split(' ');
}

/**
 * The status of a run of the lock check in a planted project after its lockfile is written for `written`
 * and its manifest moved to `current`.
 *
 * @param {string} written - The version the lockfile is written for.
 * @param {string} current - The version the manifest then pins.
 * @returns {{ readonly status: number; readonly outdated: boolean }} The run's exit status and whether pnpm called the lockfile outdated.
 */
function lockCheckAfter(written: string, current: string): { readonly status: number; readonly outdated: boolean } {
  const project = new Project({ linkModules: false });
  try {
    project.write('package.json', manifest(written));
    project.run('pnpm', 'install', '--lockfile-only', '--ignore-scripts');
    project.write('package.json', manifest(current));
    const done = project.run(...lockCheckArguments());
    return { outdated: done.stdout.includes('ERR_PNPM_OUTDATED_LOCKFILE'), status: done.status };
  } finally {
    project.remove();
  }
}

export { LOCK_CHECK, lockCheckAfter, lockCheckArguments };
