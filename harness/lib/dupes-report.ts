/**
 * Reads jscpd's JSON report: its clones, keyed for an exemption list, the files its summary lists,
 * and why a run gave no report.
 */

import { EXIT_SUCCESS } from './output.ts';
import type { Outcome } from './process.ts';
import { createHash } from 'node:crypto';
import { object } from './config.ts';
import { relativeTo as posixRelative } from './relative.ts';

/** A clone jscpd found: the run, the two files (relative to the root, sorted) and the fragment's hash. */
interface Clone {
  readonly run: string;
  readonly first: string;
  readonly second: string;
  readonly fragment: string;
}

/** The hex digits of a fragment's hash a clone key keeps. */
const FRAGMENT_DIGITS = 12;

/** The first hex digit of a hash. */
const HASH_START = 0;

/**
 * A clone's key in an exemption list.
 *
 * @param {Clone} clone - The clone.
 * @returns {string} The run, both paths and the fragment's hash.
 */
function cloneKey(clone: Clone): string {
  return `${clone.run} ${clone.first} ${clone.second} ${clone.fragment}`;
}

/**
 * A report's list, or a refusal naming what was there instead.
 *
 * @param {unknown} value - The report's value.
 * @param {string} what - What list it should be.
 * @returns {readonly unknown[]} The list.
 */
function list(value: unknown, what: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`jscpd's report holds ${JSON.stringify(value)} where the ${what} list belongs`);
  }
  return value;
}

/**
 * A reported file name relative to the root.
 *
 * @param {unknown} name - The reported name.
 * @param {string} root - The root.
 * @returns {string} The relative POSIX path.
 */
function relativeTo(name: unknown, root: string): string {
  return posixRelative(root, String(name));
}

/**
 * One duplicate of a report as a clone.
 *
 * @param {string} runName - The run.
 * @param {unknown} entry - The report's duplicate.
 * @param {string} root - The root.
 * @returns {Clone} The clone.
 */
function cloneOf(runName: string, entry: unknown, root: string): Clone {
  const fields = object(entry, 'a duplicate');
  const first = relativeTo(object(fields['firstFile'], 'firstFile')['name'], root);
  const second = relativeTo(object(fields['secondFile'], 'secondFile')['name'], root);
  const fragment = createHash('sha256').update(String(fields['fragment'])).digest('hex').slice(HASH_START, FRAGMENT_DIGITS);
  const [low = first, high = second] = [first, second].toSorted();
  return { first: low, fragment, run: runName, second: high };
}

/**
 * The clones of a parsed jscpd JSON report; the cross-file run keeps the pairs in two files.
 *
 * @param {string} runName - The run.
 * @param {unknown} report - The parsed report.
 * @param {string} root - The root.
 * @returns {readonly Clone[]} The clones.
 */
function clones(runName: string, report: unknown, root: string): readonly Clone[] {
  return list(object(report, "jscpd's report")['duplicates'], 'duplicates')
    .map((entry) => cloneOf(runName, entry, root))
    .filter((clone) => runName !== 'cross-file' || clone.first !== clone.second);
}

/**
 * The files a parsed jscpd JSON report's summary lists.
 *
 * @param {unknown} report - The parsed report.
 * @param {string} root - The root.
 * @returns {ReadonlySet<string>} The files, relative to the root.
 */
function scanned(report: unknown, root: string): ReadonlySet<string> {
  const summary = object(object(report, "jscpd's report")['summary'], 'summary');
  return new Set(list(summary['files'], 'summary files').map((entry) => relativeTo(object(entry, 'a summary file')['path'], root)));
}

/**
 * What a run that gave no report says.
 *
 * @param {Outcome} outcome - How jscpd ended.
 * @param {boolean} reported - Whether it wrote a report.
 * @returns {string | undefined} Why there is no report, or undefined when there is one.
 */
function noReport(outcome: Outcome, reported: boolean): string | undefined {
  if (outcome.kind === 'timed-out') {
    return `jscpd ran past ${outcome.timeoutMs} ms`;
  }
  if (outcome.kind === 'not-started') {
    return `jscpd could not start (${outcome.reason}): run \`pnpm install\``;
  }
  if (outcome.status !== EXIT_SUCCESS) {
    return `jscpd exited ${outcome.status}: ${outcome.stdout}${outcome.stderr}`;
  }
  return reported ? undefined : 'jscpd wrote no report';
}

export { cloneKey, clones, noReport, scanned };
export type { Clone };
