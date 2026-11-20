import type { Page } from '@playwright/test';

import { diagnosticCodes } from '../src/harness';
import type { ChxRecord, ChxState } from '../src/harness';

/** Console `[CODE]` diagnostics as Playwright sees them: the second source of truth. */
export function captureConsoleCodes(page: Page): string[] {
  const codes: string[] = [];
  page.on('console', (message) => {
    codes.push(...diagnosticCodes(message.text()));
  });
  page.on('pageerror', (error) => {
    codes.push(...diagnosticCodes(error.message));
  });
  return codes;
}

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

/** The policy the experiences ship under: scripts and styles from the page's own origin only. */
const POLICY = "script-src 'self'; style-src 'self'";

/** Serve the fixture page under `POLICY`. */
export async function servePolicy(page: Page, fixture: string): Promise<void> {
  await page.route(`**/?fixture=${fixture}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ headers: { ...response.headers(), 'content-security-policy': POLICY }, response });
  });
}

/** A record the fixture must have written. */
export function recorded(state: ChxState, id: string): ChxRecord {
  const found = rec(state, id);
  if (found === undefined) {
    throw new Error(`the fixture wrote no record ${id}: ${JSON.stringify(state.records.map((entry) => entry.id))}`);
  }
  return found;
}
