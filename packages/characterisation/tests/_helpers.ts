/** What every characterisation spec shares: the page it drives, the result bus and the policy. */

import type { ChxRecord, ChxState } from '#src/harness';
import type { ConsoleMessage, Page, Route } from '@playwright/test';
import { diagnosticCodes } from '#src/harness';

/** The page members the specs drive. */
type DrivenPage = Readonly<Pick<Page, 'evaluate' | 'goto' | 'locator' | 'on' | 'route' | 'waitForFunction'>>;

/** The test arguments a spec reads: the page, and the engine's name. */
interface SpecArguments {
  readonly page: DrivenPage;
  readonly browserName: string;
}

/** How long a fixture may run before the spec gives up waiting for it. */
const FIXTURE_TIMEOUT_MS = 15_000;

/** The policy the experiences ship under: scripts and styles from the page's own origin only. */
const POLICY = "script-src 'self'; style-src 'self'";

/**
 * Console `[CODE]` diagnostics as Playwright sees them: the second source of truth.
 * @param {DrivenPage} page The page to listen to.
 * @returns {string[]} The codes seen, appended as they come.
 */
function captureConsoleCodes(page: DrivenPage): readonly string[] {
  const codes: string[] = [];
  page.on('console', (message: Readonly<Pick<ConsoleMessage, 'text'>>) => {
    codes.push(...diagnosticCodes(message.text()));
  });
  page.on('pageerror', (error: Readonly<Pick<Error, 'message'>>) => {
    codes.push(...diagnosticCodes(error.message));
  });
  return codes;
}

/**
 * Navigate to a fixture and wait until it signals completion.
 * @param {DrivenPage} page The page.
 * @param {string} name The fixture's name.
 * @returns {Promise<ChxState>} The result bus the fixture wrote.
 */
async function runFixture(page: DrivenPage, name: string): Promise<ChxState> {
  await page.goto(`/?fixture=${name}`);
  await page.waitForFunction(() => globalThis.chxResults?.done === true, undefined, { timeout: FIXTURE_TIMEOUT_MS });
  const state = await page.evaluate(() => globalThis.chxResults);
  if (state === undefined) {
    throw new Error(`fixture ${name} finished without a result bus`);
  }
  return state;
}

/**
 * Serve the fixture page under `POLICY`.
 * @param {DrivenPage} page The page.
 * @param {string} fixture The fixture's name.
 * @returns {Promise<void>} Resolves once the route is installed.
 */
async function servePolicy(page: DrivenPage, fixture: string): Promise<void> {
  await page.route(`**/?fixture=${fixture}`, async (route: Readonly<Pick<Route, 'fetch' | 'fulfill'>>) => {
    const response = await route.fetch();
    await route.fulfill({ headers: { ...response.headers(), 'content-security-policy': POLICY }, response });
  });
}

/**
 * A record the fixture must have written.
 * @param {ChxState} state The result bus.
 * @param {string} id The record's id.
 * @returns {ChxRecord} The record.
 */
function recorded(state: Readonly<{ records: readonly ChxRecord[] }>, id: string): ChxRecord {
  const found = state.records.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`the fixture wrote no record ${id}: ${JSON.stringify(state.records.map((entry) => entry.id))}`);
  }
  return found;
}

export { captureConsoleCodes, recorded, runFixture, servePolicy };
export type { SpecArguments };
