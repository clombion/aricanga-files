/**
 * Synchronous views: what the runtime does when a part reads an async value. Parts are meant to be
 * synchronous; this records the evidence for that rule.
 */

import { createMemo, flush } from 'solid-js';
import { errorText, settle } from '#src/support';
import { markDone, record } from '#src/harness';
import type { JSX } from '@solidjs/web';
import { render } from '@solidjs/web';

/** How long the async value takes to land. */
const RESOLVES_AFTER_MS = 20;

/** How long the fixture waits for it: well past its landing. */
const WAIT_MS = 60;

/**
 * A part that reads an async value outside `<Loading>`.
 * @returns {JSX.Element} A paragraph showing the value.
 */
function AsyncPart(): JSX.Element {
  const text = createMemo(async () => {
    await settle(RESOLVES_AFTER_MS);
    return 'resolved';
  });
  return <p id="async">{text()}</p>;
}

/** The async part's host, its disposer once rendered, and what rendering threw. */
interface Mounted {
  readonly host: HTMLElement;
  dispose?: () => void;
  thrown?: string;
}

/**
 * Render the async part into a fresh host and flush.
 * @returns {Mounted} The host, the disposer and anything rendering threw.
 */
function mountedAsync(): Mounted {
  const mounted: Mounted = { host: document.createElement('div') };
  document.body.append(mounted.host);
  try {
    mounted.dispose = render(() => <AsyncPart />, mounted.host);
    flush();
  } catch (error) {
    mounted.thrown = errorText(error);
  }
  return mounted;
}

/** Render the async part, read it while pending and after it resolved, and record both. */
async function run(): Promise<void> {
  const mounted = mountedAsync();
  const { host } = mounted;
  const pending = host.textContent;
  await settle(WAIT_MS);
  flush();
  record({
    id: 'async-views/async-read-outside-loading',
    note: `thrown: ${mounted.thrown ?? '<nothing>'}; while pending: "${pending}"; after it resolved: "${host.textContent}"`,
    ok: true,
    threw: mounted.thrown !== undefined,
  });
  mounted.dispose?.();
  host.remove();
  markDone();
}

export { run };
