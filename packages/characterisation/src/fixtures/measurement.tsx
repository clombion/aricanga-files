/**
 * Measurement: a snapshot applied outside reactive scope is visible to layout only after `flush()`;
 * what `flush()` does inside an effect callback and inside `onSettled`.
 */

import { createEffect, createRoot, createSignal, createStore, flush, onSettled } from 'solid-js';
import { errorText, mount, settle } from '#src/support';
import { markDone, record } from '#src/harness';

/** A rendered element with no width has not been laid out. */
const NO_WIDTH = 0;

/** The tracked source's first value, and the value whose write runs the apply phase again. */
const FIRST_TICK = 0;
const SECOND_TICK = 1;

/**
 * The measured paragraph's text and laid-out width.
 * @param {ParentNode} host The element it is rendered into.
 * @returns {{ text: string | undefined, width: number }} What a read sees now.
 */
function measuredIn(host: Readonly<Pick<ParentNode, 'querySelector'>>): { readonly text: string | undefined; readonly width: number } {
  const measured = host.querySelector('#measured');
  return { text: measured?.textContent, width: measured?.getBoundingClientRect().width ?? NO_WIDTH };
}

/** Apply a longer text outside reactive scope and record what reads see before and after `flush()`. */
function recordApplyFlushLayout(): void {
  const [store, setStore] = createStore({ text: 'short' });
  const { host, dispose } = mount('div', () => <p id="measured">{store.text}</p>);
  flush();
  setStore(() => ({ text: 'a much longer line of text that changes the layout' }));
  const beforeFlush = measuredIn(host).text;
  flush();
  const { text: afterFlush, width } = measuredIn(host);
  record({
    id: 'measurement/apply-flush-layout',
    note: `before flush: ${beforeFlush ?? ''}; after flush: ${afterFlush ?? ''}; width ${width}`,
    ok: beforeFlush === 'short' && afterFlush?.startsWith('a much longer') === true && width > NO_WIDTH,
    threw: false,
  });
  dispose();
}

/** Call `flush()` in an effect's apply phase and record whether it threw. */
function recordFlushInEffectCallback(): void {
  const outcome: { error?: string } = {};
  const [tick, setTick] = createSignal(FIRST_TICK);
  const disposeEffect = createRoot((disposeRoot) => {
    createEffect(
      () => tick(),
      () => {
        try {
          flush();
        } catch (error) {
          outcome.error = errorText(error);
        }
      },
    );
    return disposeRoot;
  });
  flush();
  setTick(SECOND_TICK);
  flush();
  disposeEffect();
  record({
    id: 'measurement/flush-in-effect-callback',
    note: outcome.error === undefined ? 'flush() in an effect callback returned' : `refused: ${outcome.error}`,
    ok: true,
    threw: outcome.error !== undefined,
  });
}

/** Call `flush()` in `onSettled` and record whether it threw. */
async function recordFlushInOnSettled(): Promise<void> {
  const outcome: { error?: string } = {};
  const { dispose } = mount('div', () => {
    onSettled(() => {
      try {
        flush();
      } catch (error) {
        outcome.error = errorText(error);
      }
    });
    return <p>settled</p>;
  });
  flush();
  await settle();
  record({
    id: 'measurement/flush-in-on-settled',
    note: outcome.error === undefined ? 'flush() in onSettled returned' : `refused: ${outcome.error}`,
    ok: true,
    threw: outcome.error !== undefined,
  });
  dispose();
}

/** Record each measurement observation in turn. */
async function run(): Promise<void> {
  recordApplyFlushLayout();
  recordFlushInEffectCallback();
  await recordFlushInOnSettled();
  markDone();
}

export { run };
