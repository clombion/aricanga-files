/** The rules every exemption list's entries share: the key of a (path, rule) finding, and a reason each. */

import { ExemptionError } from './declaration-error.ts';

/** The length of an empty list. */
const NONE = 0;

/**
 * The key of a (path, rule) finding.
 *
 * @param {string} path - The file the finding is in.
 * @param {string} rule - The rule it breaks.
 * @returns {string} The finding's key.
 */
function site(path: string, rule: string): string {
  return `${path} :: ${rule}`;
}

/**
 * Refuse entries without a reason.
 *
 * @param {Readonly<Iterable<readonly [string, string]>>} reasons - Each entry's key and reason.
 */
function checkReasons(reasons: Readonly<Iterable<readonly [string, string]>>): void {
  const blank = [...reasons].filter(([, reason]) => reason.trim() === '').map(([key]) => key);
  if (blank.length > NONE) {
    throw new ExemptionError(`exemptions without a reason: ${JSON.stringify(blank)}`);
  }
}

export { checkReasons, site };
