/**
 * Record the characterisation performance baseline: run the performance spec in every project three
 * times, alone on one worker, and write each project's slowest fastest-of-nine to
 * packages/characterisation/performance-baseline.json (`harness/lib/performance-baseline.ts`).
 */

import { REPO_ROOT, fromRoot } from '#lib/paths.ts';
import { RUNS, recordBaseline } from '#lib/performance-baseline.ts';
import { finished } from '#lib/tools.ts';
import { out } from '#lib/output.ts';
import { writeText } from '#lib/source-files.ts';

await recordBaseline({
  out,
  results: fromRoot('packages/characterisation/.output/results'),
  root: REPO_ROOT,
  run: finished,
  runs: RUNS,
  write: writeText,
});
