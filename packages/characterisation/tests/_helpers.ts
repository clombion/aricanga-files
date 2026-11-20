import type { Page } from '@playwright/test';

import type { ChxRecord, ChxState } from '../src/harness';

/** Navigate to a fixture and wait until it signals completion. */
export async function runFixture(page: Page, name: string): Promise<ChxState> {
  await page.goto(`/?fixture=${name}`);
  await page.waitForFunction(() => window.chxResults?.done === true, null, { timeout: 15_000 });
  const state = await page.evaluate(() => window.chxResults);
  if (state === undefined) {
    throw new Error(`fixture ${name} finished without a result bus`);
  }
  return state;
}

export function rec(state: ChxState, id: string): ChxRecord | undefined {
  return state.records.find((entry) => entry.id === id);
}
