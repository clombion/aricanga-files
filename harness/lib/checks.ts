/** The shipped checks: every check module that declares a `HARNESS_ID`, with its doc comment's first line. */

import { ConfigError } from './config.ts';

/** A check module, its id and its summary. */
interface CheckModule {
  readonly harnessId: string;
  readonly path: string;
  readonly summary: string;
}

const DECLARED = /^(?:export )?const HARNESS_ID = '(?<id>[a-z0-9-]+)';$/mu;
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
 * The first line of a check module's leading doc comment: a check states what it holds there.
 *
 * @param {string} path - The module's path.
 * @param {string} text - The module's source.
 * @returns {string} The line.
 */
function summary(path: string, text: string): string {
  const line = LEADING_DOC.exec(text)?.groups?.['line'];
  if (line === undefined) {
    throw new ConfigError(`the check module ${path} opens with no doc comment stating what it holds`);
  }
  return line;
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
 * The check modules among some modules: each that declares a `HARNESS_ID`.
 *
 * @param {readonly (readonly [string, string])[]} texts - Each module's path and source.
 * @returns {readonly CheckModule[]} The check modules, sorted by id, then by path.
 */
function checkModules(texts: readonly (readonly [string, string])[]): readonly CheckModule[] {
  return texts
    .flatMap(([path, text]: readonly [string, string]) => {
      const harnessId = declaredId(text);
      return harnessId === undefined ? [] : [{ harnessId, path, summary: summary(path, text) }];
    })
    .toSorted(byId);
}

export { checkModules };
export type { CheckModule };
