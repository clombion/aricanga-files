import { readFileSync, writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { recorded, runFixture } from './_helpers';

/** The regression a run may show over its project's baseline before it fails. */
const TOLERANCE = 1.25;

interface Timing {
  readonly render: number;
  readonly updates: number;
}

function timing(value: unknown): Timing {
  if (typeof value !== 'object' || value === null || !('render' in value) || !('updates' in value)) {
    throw new Error(`not a timing: ${JSON.stringify(value)}`);
  }
  const { render, updates } = value;
  if (typeof render !== 'number' || typeof updates !== 'number') {
    throw new TypeError(`not a timing: ${JSON.stringify(value)}`);
  }
  return { render, updates };
}

function baseline(project: string): Timing {
  const parsed: unknown = JSON.parse(readFileSync(new URL('../performance-baseline.json', import.meta.url), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !(project in parsed)) {
    throw new Error(`performance-baseline.json has no entry for ${project}: run pnpm run characterise:baseline`);
  }
  return timing(Object.getOwnPropertyDescriptor(parsed, project)?.value);
}

// 1,000 messages rendered, then 100 snapshot updates applied and flushed, the fastest of nine runs
// after two warm-ups; a regression over 25 % against the project's committed baseline fails. Tagged
// @performance: the gate runs it alone, on one worker, so no other spec competes for the CPU.
test.describe('performance', () => {
  test('1,000 messages and 100 updates stay within the baseline @performance', async ({ page }, info) => {
    const state = await runFixture(page, 'performance');
    const measured = timing(JSON.parse(recorded(state, 'performance/messages').note ?? 'null'));
    writeFileSync(info.outputPath('performance.json'), JSON.stringify({ project: info.project.name, ...measured }));
    const expected = baseline(info.project.name);
    expect(measured.render, `render ms against ${expected.render}`).toBeLessThanOrEqual(expected.render * TOLERANCE);
    expect(measured.updates, `updates ms against ${expected.updates}`).toBeLessThanOrEqual(expected.updates * TOLERANCE);
  });
});
