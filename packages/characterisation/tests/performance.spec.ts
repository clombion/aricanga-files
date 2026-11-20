import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { recorded, runFixture } from './_helpers';
import type { SpecArguments } from './_helpers';

/** The regression a run may show over its project's baseline before it fails. */
const TOLERANCE = 1.25;

interface Timing {
  readonly render: number;
  readonly updates: number;
}

/** What the spec reads of its test info: where to write its output, and its project's name. */
interface RunInfo {
  readonly outputPath: (...pathSegments: readonly string[]) => string;
  readonly project: Readonly<{ name: string }>;
}

/**
 * A timing parsed from a record's note or a baseline entry.
 * @param {unknown} value The parsed JSON.
 * @returns {Timing} The render and update times.
 */
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

/**
 * The committed baseline of a project.
 * @param {string} project The Playwright project's name.
 * @returns {Promise<Timing>} Its baseline timings.
 */
async function baseline(project: string): Promise<Timing> {
  const parsed: unknown = JSON.parse(await readFile(new URL('../performance-baseline.json', import.meta.url), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !Object.hasOwn(parsed, project)) {
    throw new Error(`performance-baseline.json has no entry for ${project}: run pnpm run characterise:baseline`);
  }
  return timing(Object.getOwnPropertyDescriptor(parsed, project)?.value);
}

// 1,000 messages rendered, then 100 snapshot updates applied and flushed, the fastest of nine runs
// after two warm-ups; a regression over 25 % against the project's committed baseline fails. Tagged
// @performance: the gate runs it alone, on one worker, so no other spec competes for the CPU.
test.describe('performance', () => {
  test('1,000 messages and 100 updates stay within the baseline @performance', async ({ page }: SpecArguments, info: RunInfo) => {
    const state = await runFixture(page, 'performance');
    const measured = timing(JSON.parse(recorded(state, 'performance/messages').note ?? 'null'));
    await writeFile(info.outputPath('performance.json'), JSON.stringify({ project: info.project.name, ...measured }));
    const expected = await baseline(info.project.name);
    expect(measured.render, `render ms against ${expected.render}`).toBeLessThanOrEqual(expected.render * TOLERANCE);
    expect(measured.updates, `updates ms against ${expected.updates}`).toBeLessThanOrEqual(expected.updates * TOLERANCE);
  });
});
