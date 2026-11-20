/**
 * Synchronous views: what the runtime does when a part reads an async value. Parts are meant to be
 * synchronous; this records the evidence for that rule.
 */

import { render } from '@solidjs/web';
import { createMemo, flush } from 'solid-js';

import { markDone, record } from '../harness';
import { errorText, settle } from '../support';

function AsyncPart() {
  const text = createMemo(async () => {
    await settle(20);
    return 'resolved';
  });
  return <p id="async">{text()}</p>;
}

export async function run(): Promise<void> {
  const host = document.createElement('div');
  document.body.append(host);
  let thrown: string | undefined;
  let dispose: (() => void) | undefined;
  try {
    dispose = render(() => <AsyncPart />, host);
    flush();
  } catch (error) {
    thrown = errorText(error);
  }
  const pending = host.textContent ?? '';
  await settle(60);
  flush();
  record({
    id: 'async-views/async-read-outside-loading',
    ok: true,
    threw: thrown !== undefined,
    note: `thrown: ${thrown ?? '<nothing>'}; while pending: "${pending}"; after it resolved: "${host.textContent ?? ''}"`,
  });
  dispose?.();
  host.remove();
  markDone();
}
