/**
 * Recording the characterisation performance baseline: the performance spec runs in every project
 * several times, alone on one worker, and each project's slowest fastest-of-nine becomes its
 * baseline, so noise between runs stays inside the margin.
 */

import { readFile, readdir } from 'node:fs/promises';
import type { Finished } from './process.ts';
import type { Report } from './script-entries.ts';
import { bin } from './tools.ts';
import { byCodeUnit } from './lists.ts';
import { parsed } from './config.ts';
import path from 'node:path';

/** One project's timings, in milliseconds. */
interface Timing {
  readonly render: number;
  readonly updates: number;
}

/** A baseline recording's inputs: where the spec writes its reports, how it is run, and where to report and write. */
interface BaselineRun {
  readonly results: string;
  readonly root: string;
  readonly runs: number;
  readonly run: (argv: readonly string[], options: Readonly<{ cwd: string }>) => Promise<Finished>;
  readonly write: (relative: string, text: string) => Promise<void>;
  readonly out: Report;
}

/** Where the baseline is written, relative to the repository root. */
const BASELINE = 'packages/characterisation/performance-baseline.json';

/** How many times the spec runs for a recorded baseline. */
const RUNS = 3;

const NO_RUNS = 0;
const ONE_RUN = 1;
const INDENT = 2;
const NO_TIME = 0;

/** The spec's invocation: the performance tests alone, one worker. */
const RUN_ARGUMENTS: readonly string[] = [
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
 * @param {string} results - The results directory.
 * @param {string} directory - One test's result directory under it.
 * @returns {Promise<string | undefined>} The report's text, or undefined.
 */
async function reportText(results: string, directory: string): Promise<string | undefined> {
  try {
    const text = await readFile(path.join(results, directory, 'performance.json'), 'utf8');
    return text;
  } catch {
    // A result directory without a performance report belongs to another spec.
    return undefined;
  }
}

/**
 * A performance report's project and timing.
 *
 * @param {string} text - The report's text.
 * @returns {readonly [string, Timing] | undefined} The project and its timing, or undefined when the report has another shape.
 */
function timingOf(text: string): readonly [string, Timing] | undefined {
  const report = parsed(text, 'the performance report');
  if (typeof report !== 'object' || report === null || !('project' in report) || !('render' in report) || !('updates' in report)) {
    return undefined;
  }
  const { project, render, updates } = report;
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
function slower(timing: Readonly<Timing>, slowest: Readonly<Timing> | undefined): Timing {
  return {
    render: Math.max(timing.render, slowest?.render ?? NO_TIME),
    updates: Math.max(timing.updates, slowest?.updates ?? NO_TIME),
  };
}

/**
 * Run the spec once and fold its reports into the baseline.
 *
 * @param {BaselineRun} recording - Where the reports land, how the spec runs, and the report.
 * @param {Readonly<ReadonlyMap<string, Timing>>} baseline - The slowest timings so far, by project.
 * @returns {Promise<ReadonlyMap<string, Timing>>} The baseline with this run's reports folded in.
 */
async function recordRun(
  recording: Readonly<BaselineRun>,
  baseline: Readonly<ReadonlyMap<string, Timing>>,
): Promise<ReadonlyMap<string, Timing>> {
  const finished = await recording.run(RUN_ARGUMENTS, { cwd: recording.root });
  recording.out(`performance run exited ${finished.status}\n`);
  const directories = await readdir(recording.results);
  const reports = await Promise.all(
    directories.map(async (directory) => {
      const text = await reportText(recording.results, directory);
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
 * @param {BaselineRun} recording - Where the reports land, how the spec runs, and the report.
 * @param {number} remaining - How many runs are left.
 * @param {Readonly<ReadonlyMap<string, Timing>>} baseline - The slowest timings so far, by project.
 * @returns {Promise<ReadonlyMap<string, Timing>>} The slowest timings after every run.
 */
async function runsFrom(
  recording: Readonly<BaselineRun>,
  remaining: number,
  baseline: Readonly<ReadonlyMap<string, Timing>>,
): Promise<ReadonlyMap<string, Timing>> {
  if (remaining === NO_RUNS) {
    return baseline;
  }
  const next = await recordRun(recording, baseline);
  return runsFrom(recording, remaining - ONE_RUN, next);
}

/**
 * Run the spec `runs` times and write each project's slowest timings, sorted by project.
 *
 * @param {BaselineRun} recording - Where the reports land, how the spec runs, the writer and the report.
 */
async function recordBaseline(recording: Readonly<BaselineRun>): Promise<void> {
  const baseline = await runsFrom(recording, recording.runs, new Map());
  const sorted = Object.fromEntries(
    [...baseline].toSorted(([left]: readonly [string, Timing], [right]: readonly [string, Timing]) => byCodeUnit(left, right)),
  );
  await recording.write(BASELINE, `${JSON.stringify(sorted, undefined, INDENT)}\n`);
  recording.out(`baseline written for ${Object.keys(sorted).join(', ')}\n`);
}

export { BASELINE, recordBaseline, RUN_ARGUMENTS, RUNS, timingOf };
