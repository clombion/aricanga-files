/**
 * The characterisation result bus: fixtures write to it and the Playwright specs read it back.
 * Results land in three places, so a spec asserts whichever is most robust for the behaviour:
 *   1. `window.chxResults`: structured records, read through `page.evaluate`;
 *   2. a `<pre id="results">`: a JSON mirror in the DOM;
 *   3. the console: Solid's own `[CODE]` diagnostics, also captured by Playwright.
 */

export interface ChxRecord {
  readonly id: string;
  /** Whether the behaviour matched the expectation the fixture encodes. */
  readonly ok: boolean;
  /** Whether the operation threw synchronously (a dev-mode refusal). */
  readonly threw: boolean;
  /** The thrown error's message, if any. */
  readonly error?: string;
  /** Evidence for ADR-0009. */
  readonly note?: string;
}

export interface ChxState {
  readonly records: ChxRecord[];
  /** Diagnostic `[CODE]` strings seen by the in-page console hook. */
  readonly diagnostics: string[];
  done: boolean;
}

declare global {
  interface Window {
    chxResults?: ChxState;
  }
}

const DIAGNOSTIC = /\[([A-Z0-9_]+)\]/g;

/** The `[CODE]` diagnostic codes in a console line: upper case with an underscore. */
export function diagnosticCodes(text: string): string[] {
  return [...text.matchAll(DIAGNOSTIC)]
    .map((match) => match[1] ?? '')
    .filter((code) => code.includes('_') && code === code.toUpperCase());
}

// Solid's dev build prints `[CODE] message`. The codes are captured in the page as well as by
// Playwright's console listener, so a fixture can assert on them synchronously.
function hookConsole(state: ChxState): void {
  for (const level of ['error', 'warn', 'log'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      state.diagnostics.push(...diagnosticCodes(args.map(String).join(' ')));
      original(...args);
    };
  }
}

function bus(): ChxState {
  if (window.chxResults === undefined) {
    const state: ChxState = { records: [], diagnostics: [], done: false };
    window.chxResults = state;
    hookConsole(state);
    return state;
  }
  return window.chxResults;
}

function paint(): void {
  const state = bus();
  let pre = document.getElementById('results');
  if (pre === null) {
    pre = document.createElement('pre');
    pre.id = 'results';
    document.body.append(pre);
  }
  pre.textContent = JSON.stringify(state, null, 2);
}

export function record(entry: ChxRecord): void {
  bus().records.push(entry);
  paint();
}

/** Run `fn`; the record is ok when it throws (an expected refusal). */
export function expectRefused(id: string, fn: () => void, note = 'expected a refusal'): void {
  try {
    fn();
    record({ id, ok: false, threw: false, note: `did not throw: ${note}` });
  } catch (error) {
    record({ id, ok: true, threw: true, error: error instanceof Error ? error.message : String(error), note });
  }
}

/** Run `fn`; the record is ok when it completes without throwing. */
export function expectAllowed(id: string, fn: () => void, note = 'expected to be allowed'): void {
  try {
    fn();
    record({ id, ok: true, threw: false, note });
  } catch (error) {
    record({ id, ok: false, threw: true, error: error instanceof Error ? error.message : String(error), note });
  }
}

export function markDone(): void {
  bus().done = true;
  paint();
}

export function sawDiagnostic(code: string): boolean {
  return bus().diagnostics.includes(code);
}
