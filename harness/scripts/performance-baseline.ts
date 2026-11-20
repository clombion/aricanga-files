/**
 * Record the characterisation performance baseline: run the performance spec in every project three
 * times, alone on one worker, and write each project's slowest fastest-of-nine to
 * packages/characterisation/performance-baseline.json, so noise between runs stays inside the margin.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, fromRoot } from '../lib/paths.ts';
import { bin, finished } from '../lib/tools.ts';
import { json } from '../lib/config.ts';
import { out } from '../lib/output.ts';

const RESULTS = fromRoot('packages/characterisation/.output/results');
const RUNS = 3;
const baseline: Record<string, { render: number; updates: number }> = {};
for (let runIndex = 0; runIndex < RUNS; runIndex += 1) {
  record(
    finished(
      [bin('playwright'), 'test', '-c', 'packages/characterisation/playwright.characterisation.config.ts', '--grep', '@performance', '--workers=1'],
      { cwd: REPO_ROOT },
    ).status,
  );
}

function record(status: number): void {
  out(`performance run exited ${status}\n`);
  for (const entry of readdirSync(RESULTS)) {
  const file = join(RESULTS, entry, 'performance.json');
  try {
    const parsed = json(readFileSync(file, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && 'project' in parsed && 'render' in parsed && 'updates' in parsed) {
      const { project, render, updates } = parsed;
      if (typeof project === 'string' && typeof render === 'number' && typeof updates === 'number') {
        const slowest = baseline[project];
        baseline[project] = {
          render: Math.max(render, slowest?.render ?? 0),
          updates: Math.max(updates, slowest?.updates ?? 0),
        };
      }
    }
  } catch {
    // A result directory without a performance report belongs to another spec.
  }
  }
}
const sorted = Object.fromEntries(Object.entries(baseline).toSorted(([a], [b]) => a.localeCompare(b)));
writeFileSync(fromRoot('packages/characterisation/performance-baseline.json'), `${JSON.stringify(sorted, null, 2)}\n`);
out(`baseline written for ${Object.keys(sorted).join(', ')}\n`);
