/** The tasks of the repository's root `package.json`, read from the root manifest as the population read it (`scope.ts`). */

import type { Task } from './config.ts';
import { population } from './scope.ts';
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

export { repoTasks };
