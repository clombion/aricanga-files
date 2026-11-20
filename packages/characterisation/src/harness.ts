// Characterisation harness: a tiny result bus the fixtures write to and the
// Playwright specs read back. Results land in three places so a spec can assert
// whichever is most robust for the behaviour under test:
//   1. window.__chx.records  — structured array, read via page.evaluate
//   2. a <pre id="results">  — JSON mirror in the DOM (survives navigation waits)
//   3. the console           — Solid's own [CODE] diagnostics, captured by page.on('console')

export interface ChxRecord {
  readonly id: string;
  /** Did the behaviour match the expectation the fixture encodes? */
  readonly ok: boolean;
  /** Did the operation throw synchronously (dev-mode refusal)? */
  readonly threw: boolean;
  /** The thrown error's message / diagnostic code, if any. */
  readonly error?: string;
  /** Free-form evidence for the ADR-0009 write-up. */
  readonly note?: string;
}

declare global {
  interface Window {
    __chx: {
      records: ChxRecord[];
      /** Diagnostic [CODE] strings seen by the in-page console hook. */
      diagnostics: string[];
      done: boolean;
    };
  }
}

function bus() {
  if (!window.__chx) {
    window.__chx = { records: [], diagnostics: [], done: false };
    hookConsole();
  }
  return window.__chx;
}

// Solid's dev diagnostics print `[CODE] message`. Capture the codes in-page as
// well as via Playwright's console listener, so a fixture can assert on them
// synchronously and a spec has a second source of truth.
function hookConsole(): void {
  const codeRe = /\[([A-Z0-9_]+)\]/g;
  for (const level of ['error', 'warn', 'log'] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      const text = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
      let m: RegExpExecArray | null;
      while ((m = codeRe.exec(text)) !== null) {
        const code = m[1];
        if (code && code === code.toUpperCase() && code.includes('_')) {
          window.__chx.diagnostics.push(code);
        }
      }
      orig(...args);
    };
  }
}

export function record(r: ChxRecord): void {
  const b = bus();
  b.records.push(r);
  paint();
}

/** Run `fn`, recording whether it threw and the error/diagnostic-code it produced. */
export function expectRefused(id: string, fn: () => void, note?: string): void {
  try {
    fn();
    record({ id, ok: false, threw: false, note: note ?? 'did NOT throw (expected refusal)' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record({ id, ok: true, threw: true, error: msg, note });
  }
}

/** Run `fn`, recording whether it completed without throwing (expected to be allowed). */
export function expectAllowed(id: string, fn: () => void, note?: string): void {
  try {
    fn();
    record({ id, ok: true, threw: false, note });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record({ id, ok: false, threw: true, error: msg, note: note ?? 'threw (expected allowed)' });
  }
}

export function markDone(): void {
  bus().done = true;
  paint();
}

export function sawDiagnostic(code: string): boolean {
  return bus().diagnostics.includes(code);
}

function paint(): void {
  const b = bus();
  let pre = document.getElementById('results');
  if (!pre) {
    pre = document.createElement('pre');
    pre.id = 'results';
    document.body.appendChild(pre);
  }
  pre.textContent = JSON.stringify({ records: b.records, diagnostics: b.diagnostics, done: b.done }, null, 2);
}
