/**
 * The TypeScript projects the gate type-checks: every held `tsconfig*.json` but the shared base,
 * derived from the listing so a new project is checked the moment it exists.
 */

import { bin, finished } from './tools.ts';
import type { Finished } from './process.ts';
import { heldFiles } from './scope.ts';

const BASE = 'tsconfig.base.json';

const PROJECT = /(?:^|\/)tsconfig(?:\.[a-z]+)?\.json$/u;

/**
 * Every held TypeScript project file.
 *
 * @returns {Promise<readonly string[]>} The held `tsconfig*.json` paths but the shared base.
 */
async function projects(): Promise<readonly string[]> {
  const files = await heldFiles('.json');
  return files.filter((path) => PROJECT.test(path) && path !== BASE);
}

/**
 * Type-check one project with the locked `tsc`, emitting nothing.
 *
 * @param {string} project - The project's `tsconfig*.json`, relative to `root`.
 * @param {string} root - Where `tsc` runs.
 * @returns {Promise<Finished>} The finished run.
 */
async function typecheckProject(project: string, root: string): Promise<Finished> {
  const outcome = await finished([bin('tsc'), '--noEmit', '-p', project], { cwd: root });
  return outcome;
}

export { projects, typecheckProject };
