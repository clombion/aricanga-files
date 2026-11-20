/**
 * The characterisation result bus: fixtures write to it and the Playwright specs read it back.
 * Results land in three places, so a spec asserts whichever is most robust for the behaviour:
 *   1. `globalThis.chxResults`: structured records, read through `page.evaluate`;
 *   2. a `<pre id="results">`: a JSON mirror in the DOM;
 *   3. the console: Solid's own `[CODE]` diagnostics, also captured by Playwright.
 */

interface ChxRecord {
  readonly id: string;
  /** Whether the behaviour matched the expectation the fixture encodes. */
  readonly ok: boolean;
  /** Whether the operation threw synchronously (a dev-mode refusal). */
  readonly threw: boolean;
  /** The thrown error's message, if any. */
  readonly error?: string;
  /** Evidence for ADR-0008. */
  readonly note?: string;
}

interface ChxState {
  readonly records: ChxRecord[];
  /** Diagnostic `[CODE]` strings seen by the in-page console hook. */
  readonly diagnostics: string[];
  done: boolean;
}

declare global {
  var chxResults: ChxState | undefined;
}

const DIAGNOSTIC = /\[(?<code>[A-Z0-9_]+)\]/gu;

/** The indentation of the DOM mirror's JSON. */
const MIRROR_INDENT = 2;

/**
 * The `[CODE]` diagnostic codes in a console line: upper case with an underscore.
 * @param {string} text A console line.
 * @returns {string[]} The codes it holds, in order.
 */
function diagnosticCodes(text: string): string[] {
  const codes: string[] = [];
  for (const match of text.matchAll(DIAGNOSTIC)) {
    const code = match.groups?.['code'] ?? '';
    if (code.includes('_') && code === code.toUpperCase()) {
      codes.push(code);
    }
  }
  return codes;
}

// Solid's dev build prints `[CODE] message`. The codes are captured in the page as well as by
// Playwright's console listener, so a fixture can assert on them synchronously.
function hookConsole(seen: (codes: readonly string[]) => void): void {
  for (const level of ['error', 'warn', 'log'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: readonly unknown[]): void => {
      seen(diagnosticCodes(args.map(String).join(' ')));
      original(...args);
    };
  }
}

function bus(): ChxState {
  if (globalThis.chxResults === undefined) {
    const state: ChxState = { diagnostics: [], done: false, records: [] };
    globalThis.chxResults = state;
    hookConsole((codes) => {
      state.diagnostics.push(...codes);
    });
    return state;
  }
  return globalThis.chxResults;
}

function paint(): void {
  const state = bus();
  const existing = document.querySelector('#results');
  const pre = existing ?? document.createElement('pre');
  if (existing === null) {
    pre.id = 'results';
    document.body.append(pre);
  }
  pre.textContent = JSON.stringify(state, undefined, MIRROR_INDENT);
}

/**
 * Record one observation on the bus and mirror it into the DOM.
 * @param {ChxRecord} entry The observation.
 */
function record(entry: ChxRecord): void {
  bus().records.push(entry);
  paint();
}

/** Mark the fixture finished: the specs wait for this. */
function markDone(): void {
  bus().done = true;
  paint();
}

export { diagnosticCodes, markDone, record };
export type { ChxRecord, ChxState };
