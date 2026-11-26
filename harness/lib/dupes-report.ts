/**
 * Reads jscpd's JSON report: its clones, keyed for an exemption list, the files its summary lists,
 * and why a run gave no report.
 */

import { list, object, stringOf } from './config.ts';
import type { Outcome } from './process.ts';
import { byKind } from './by-kind.ts';
import { createHash } from 'node:crypto';
import { relativeTo as posixRelative } from './relative.ts';
import { succeeded } from './exit-status.ts';

/** A jscpd run's name. */
type Run = 'cross-file' | 'exact';

/** A clone jscpd found: the run, the two files (relative to the root, sorted) and the fragment's hash. */
interface Clone {
  readonly run: Run;
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
 * A reported file name relative to the root.
 *
 * @param {unknown} name - The reported name.
 * @param {string} root - The root.
 * @returns {string} The relative POSIX path.
 */
function relativeTo(name: unknown, root: string): string {
  return posixRelative(root, stringOf(name, 'a reported file name'));
}

/**
 * One duplicate of a report as a clone.
 *
 * @param {Run} runName - The run.
 * @param {unknown} entry - The report's duplicate.
 * @param {string} root - The root.
 * @returns {Clone} The clone.
 */
function cloneOf(runName: Run, entry: unknown, root: string): Clone {
  const fields = object(entry, 'a duplicate');
  const first = relativeTo(object(fields['firstFile'], 'firstFile')['name'], root);
  const second = relativeTo(object(fields['secondFile'], 'secondFile')['name'], root);
  const fragment = createHash('sha256')
    .update(stringOf(fields['fragment'], 'a duplicate fragment'))
    .digest('hex')
    .slice(HASH_START, FRAGMENT_DIGITS);
  const [low = first, high = second] = [first, second].toSorted();
  return { first: low, fragment, run: runName, second: high };
}

/** The run a report came from: its name, and whether it keeps a clone whose two copies are in one file. */
interface ReportRun {
  readonly name: Run;
  readonly sameFile: boolean;
}

/**
 * The clones of a parsed jscpd JSON report; a run that does not keep same-file pairs keeps the pairs in two files.
 *
 * @param {ReportRun} run - The run.
 * @param {unknown} report - The parsed report.
 * @param {string} root - The root.
 * @returns {readonly Clone[]} The clones.
 */
function clones(run: Readonly<ReportRun>, report: unknown, root: string): readonly Clone[] {
  return list(object(report, "jscpd's report")['duplicates'], "jscpd's report's duplicates")
    .map((entry) => cloneOf(run.name, entry, root))
    .filter((clone) => run.sameFile || clone.first !== clone.second);
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
  return new Set(
    list(summary['files'], "jscpd's report's summary files").map((entry) => relativeTo(object(entry, 'a summary file')['path'], root)),
  );
}

/**
 * What a run that gave no report says.
 *
 * @param {Outcome} outcome - How jscpd ended.
 * @param {boolean} reported - Whether it wrote a report.
 * @returns {string | undefined} Why there is no report, or undefined when there is one.
 */
function noReport(outcome: Outcome, reported: boolean): string | undefined {
  return byKind(outcome, {
    finished: (run) => {
      if (!succeeded(run)) {
        return `jscpd exited ${run.status}: ${run.stdout}${run.stderr}`;
      }
      return reported ? undefined : 'jscpd wrote no report';
    },
    'not-started': (run) => `jscpd could not start (${run.reason}): run \`pnpm install\``,
    'timed-out': (run) => `jscpd ran past ${run.timeoutMs} ms`,
  });
}

export { cloneKey, clones, noReport, scanned };
export type { Clone, Run };
