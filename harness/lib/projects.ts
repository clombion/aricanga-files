/**
 * The TypeScript projects the gate type-checks: every held `tsconfig*.json` but the shared base,
 * derived from the listing so a new project is checked the moment it exists.
 */

import { heldFiles } from './scope.ts';

const BASE = 'tsconfig.base.json';

const PROJECT = /(?:^|\/)tsconfig(?:\.[a-z]+)?\.json$/u;

/**
 * Every held TypeScript project file.
 *
 * @returns {readonly string[]} The held `tsconfig*.json` paths but the shared base.
 */
function projects(): readonly string[] {
  return heldFiles('.json').filter((path) => PROJECT.test(path) && path !== BASE);
}

export { projects };
