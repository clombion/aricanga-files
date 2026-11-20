import type { Page } from '@playwright/test';

export interface ChxRecord {
  id: string;
  ok: boolean;
  threw: boolean;
  error?: string;
  note?: string;
}

export interface ChxState {
  records: ChxRecord[];
  diagnostics: string[];
  done: boolean;
}

/** Console [CODE] strings seen by Playwright directly (second source of truth). */
export function captureConsoleCodes(page: Page): string[] {
  const codes: string[] = [];
  const re = /\[([A-Z0-9_]+)\]/g;
  page.on('console', (msg) => {
    const text = msg.text();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const code = m[1];
      if (code && code === code.toUpperCase() && code.includes('_')) codes.push(code);
    }
  });
  page.on('pageerror', (err) => {
    const m = /\[([A-Z0-9_]+)\]/.exec(err.message);
    if (m?.[1]) codes.push(m[1]);
  });
  return codes;
}

/** Navigate to a fixture and wait until it signals completion. */
export async function runFixture(page: Page, name: string): Promise<ChxState> {
  await page.goto(`/?fixture=${name}`);
  await page.waitForFunction(() => window.__chx?.done === true, null, { timeout: 15_000 });
  return page.evaluate(() => ({
    records: window.__chx.records,
    diagnostics: window.__chx.diagnostics,
    done: window.__chx.done,
  }));
}

export function rec(state: ChxState, id: string): ChxRecord | undefined {
  return state.records.find((r) => r.id === id);
}

declare global {
  interface Window {
    __chx: ChxState;
  }
}
