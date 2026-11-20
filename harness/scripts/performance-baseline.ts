/**
 * Record the characterisation performance baseline: run the performance spec in every project three
 * times, alone on one worker, and write each project's slowest fastest-of-nine to
 * packages/characterisation/performance-baseline.json, so noise between runs stays inside the margin.
 */

import { REPO_ROOT, fromRoot } from '#lib/paths.ts';
import { bin, finished } from '#lib/tools.ts';
import { readFile, readdir } from 'node:fs/promises';
import { json } from '#lib/config.ts';
import { out } from '#lib/output.ts';
import path from 'node:path';
import { writeText } from '#lib/source-files.ts';

/** One project's timings, in milliseconds. */
interface Timing {
  readonly render: number;
  readonly updates: number;
}

const RESULTS = fromRoot('packages/characterisation/.output/results');
const RUNS = 3;
const NO_RUNS = 0;
const ONE_RUN = 1;
const INDENT = 2;
const NO_TIME = 0;
const RUN_ARGUMENTS = [
  bin('playwright'),
  'test',
  '-c',
  'packages/characterisation/playwright.characterisation.config.ts',
  '--grep',
  '@performance',
  '--workers=1',
];

/**
 * A result directory's performance report text, if it holds one.
 *
 * @param {string} directory - The result directory.
 * @returns {Promise<string | undefined>} The report's text, or undefined.
 */
async function reportText(directory: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(RESULTS, directory, 'performance.json'), 'utf8');
  } catch {
    // A result directory without a performance report belongs to another spec.
    return undefined;
  }
}

/**
 * A performance report's project and timing.
 *
 * @param {string} text - The report's text.
 * @returns {readonly [string, Timing] | undefined} The project and its timing, or undefined.
 */
function timingOf(text: string): readonly [string, Timing] | undefined {
  const parsed = json(text);
  if (typeof parsed !== 'object' || parsed === null || !('project' in parsed) || !('render' in parsed) || !('updates' in parsed)) {
    return undefined;
  }
  const { project, render, updates } = parsed;
  if (typeof project !== 'string' || typeof render !== 'number' || typeof updates !== 'number') {
    return undefined;
  }
  return [project, { render, updates }];
}

/**
 * The slower of two timings, field by field.
 *
 * @param {Timing} timing - A new timing.
 * @param {Timing | undefined} slowest - The slowest timing so far.
 * @returns {Timing} The slower of each field.
 */
function slower(timing: Timing, slowest: Timing | undefined): Timing {
  return {
    render: Math.max(timing.render, slowest?.render ?? NO_TIME),
    updates: Math.max(timing.updates, slowest?.updates ?? NO_TIME),
  };
}

/**
 * Run the performance spec once and fold its reports into the baseline.
 *
 * @param {Readonly<ReadonlyMap<string, Timing>>} baseline - The slowest timings so far, by project.
 * @returns {Promise<ReadonlyMap<string, Timing>>} The baseline with this run's reports folded in.
 */
async function recordRun(baseline: Readonly<ReadonlyMap<string, Timing>>): Promise<ReadonlyMap<string, Timing>> {
  const run = await finished(RUN_ARGUMENTS, { cwd: REPO_ROOT });
  out(`performance run exited ${run.status}\n`);
  const directories = await readdir(RESULTS);
  const reports = await Promise.all(
    directories.map(async (directory) => {
      const text = await reportText(directory);
      return text === undefined ? undefined : timingOf(text);
    }),
  );
  const next = new Map(baseline);
  for (const report of reports) {
    if (report !== undefined) {
      const [project, timing] = report;
      next.set(project, slower(timing, next.get(project)));
    }
  }
  return next;
}

/**
 * Run the spec `remaining` more times, one after another: each run needs the machine to itself.
 *
 * @param {number} remaining - How many runs are left.
 * @param {Readonly<ReadonlyMap<string, Timing>>} baseline - The slowest timings so far, by project.
 * @returns {Promise<ReadonlyMap<string, Timing>>} The slowest timings after every run.
 */
async function runsFrom(remaining: number, baseline: Readonly<ReadonlyMap<string, Timing>>): Promise<ReadonlyMap<string, Timing>> {
  if (remaining === NO_RUNS) {
    return baseline;
  }
  return runsFrom(remaining - ONE_RUN, await recordRun(baseline));
}

/** Run the spec `RUNS` times and write the slowest timings. */
async function main(): Promise<void> {
  const baseline = await runsFrom(RUNS, new Map());
  const sorted = Object.fromEntries(
    [...baseline].toSorted(([left]: readonly [string, Timing], [right]: readonly [string, Timing]) => left.localeCompare(right)),
  );
  await writeText('packages/characterisation/performance-baseline.json', `${JSON.stringify(sorted, undefined, INDENT)}\n`);
  out(`baseline written for ${Object.keys(sorted).join(', ')}\n`);
}

await main();
