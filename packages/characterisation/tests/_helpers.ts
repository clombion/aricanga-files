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

/** What a characterisation reads after its fixture ran: the result bus, the console codes, the page and the engine. */
interface Observed {
  /** The records the fixture wrote. */
  readonly state: Readonly<{ records: readonly ChxRecord[] }>;
  readonly codes: readonly string[];
  readonly page: DrivenPage;
  readonly browserName: string;
}

/** How a fixture page is served. */
interface Serving {
  /** Serve it under the experiences' content security policy. */
  readonly underPolicy?: boolean;
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

/**
 * The body of a characterisation test: run `fixture` in a real page, its console codes captured and,
 * when asked, under the policy, then hold the claim's observations with `check`.
 * @param {string} fixture The fixture page that observes the surface.
 * @param {Function} check The assertions over what the fixture observed.
 * @param {Serving} serving How the page is served.
 * @returns {Function} The test body.
 */
function characterised(
  fixture: string,
  check: (observed: Readonly<Observed>) => Promise<void> | void,
  serving: Readonly<Serving> = {},
): (args: SpecArguments) => Promise<void> {
  return async ({ browserName, page }: SpecArguments): Promise<void> => {
    const codes = captureConsoleCodes(page);
    if (serving.underPolicy === true) {
      await servePolicy(page, fixture);
    }
    const state = await runFixture(page, fixture);
    await check({ browserName, codes, page, state });
  };
}

export { characterised, recorded, runFixture };
export type { SpecArguments };
