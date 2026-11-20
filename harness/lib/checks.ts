/** The shipped checks: every check module that declares a `HARNESS_ID`, with its doc comment's first line. */

import { textOf, tracked } from './source-files.ts';

/** A check module, its id and its summary. */
interface CheckModule {
  readonly harnessId: string;
  readonly path: string;
  readonly summary: string;
}

const DECLARED = /^export const HARNESS_ID = '(?<id>[a-z0-9-]+)';$/mu;
const LEADING_DOC = /^\/\*\*\s*\n?\s*\*?\s*(?<line>.+?)\s*(?:\n|\*\/)/u;

/**
 * The `HARNESS_ID` a module's source declares, if any.
 *
 * @param {string} text - The module's source.
 * @returns {string | undefined} The declared id, or undefined.
 */
function declaredId(text: string): string | undefined {
  return DECLARED.exec(text)?.groups?.['id'];
}

/**
 * The first line of a module's leading doc comment.
 *
 * @param {string} text - The module's source.
 * @returns {string} The line, or the empty string.
 */
function summary(text: string): string {
  return LEADING_DOC.exec(text)?.groups?.['line'] ?? '';
}

/**
 * Order check modules by id, then by path.
 *
 * @param {CheckModule} left - A module.
 * @param {CheckModule} right - Another module.
 * @returns {number} Their order.
 */
function byId(left: CheckModule, right: CheckModule): number {
  return left.harnessId.localeCompare(right.harnessId) || left.path.localeCompare(right.path);
}

/**
 * Every listed check module declaring a `HARNESS_ID`.
 *
 * @returns {readonly CheckModule[]} The modules, sorted by id.
 */
function checkModules(): readonly CheckModule[] {
  return tracked()
    .filter((path) => path.startsWith('harness/checks/') && path.endsWith('.test.ts'))
    .flatMap((path) => {
      const text = textOf(path);
      const harnessId = declaredId(text);
      return harnessId === undefined ? [] : [{ harnessId, path, summary: summary(text) }];
    })
    .toSorted(byId);
}

export { checkModules };
