/**
 * The TypeScript projects the gate type-checks: every held `tsconfig*.json` but the shared base,
 * derived from the listing so a new project is checked the moment it exists.
 */

import { heldFiles } from './scope.ts';

export const BASE = 'tsconfig.base.json';

/** Every held TypeScript project file. */
export function projects(): readonly string[] {
  return heldFiles('.json').filter((path) => /(^|\/)tsconfig(\.[a-z]+)?\.json$/.test(path) && path !== BASE);
}
