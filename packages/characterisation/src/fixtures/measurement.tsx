/**
 * Measurement: a snapshot applied outside reactive scope is visible to layout only after `flush()`;
 * what `flush()` does inside an effect callback and inside `onSettled`.
 */

import { createEffect, createRoot, createSignal, createStore, flush, onSettled } from 'solid-js';

import { markDone, record } from '../harness';
import { errorText, mount, settle } from '../support';

export async function run(): Promise<void> {
  const [store, setStore] = createStore({ text: 'short' });
  const { host, dispose } = mount('div', () => <p id="measured">{store.text}</p>);
  flush();

  setStore((draft) => {
    draft.text = 'a much longer line of text that changes the layout';
  });
  const beforeFlush = host.querySelector('#measured')?.textContent;
  flush();
  const afterFlush = host.querySelector('#measured')?.textContent;
  const width = host.querySelector('#measured')?.getBoundingClientRect().width ?? 0;
  record({
    id: 'measurement/apply-flush-layout',
    note: `before flush: ${beforeFlush ?? ''}; after flush: ${afterFlush ?? ''}; width ${width}`,
    ok: beforeFlush === 'short' && afterFlush?.startsWith('a much longer') === true && width > 0,
    threw: false,
  });
  dispose();

  let effectError: string | undefined;
  const [tick, setTick] = createSignal(0);
  const disposeEffect = createRoot((disposeRoot) => {
    createEffect(
      () => tick(),
      () => {
        try {
          flush();
        } catch (error) {
          effectError = errorText(error);
        }
      },
    );
    return disposeRoot;
  });
  flush();
  setTick(1);
  flush();
  disposeEffect();
  record({
    id: 'measurement/flush-in-effect-callback',
    note: effectError === undefined ? 'flush() in an effect callback returned' : `refused: ${effectError}`,
    ok: true,
    threw: effectError !== undefined,
  });

  let settledError: string | undefined;
  const { dispose: disposeSettled } = mount('div', () => {
    onSettled(() => {
      try {
        flush();
      } catch (error) {
        settledError = errorText(error);
      }
    });
    return <p>settled</p>;
  });
  flush();
  await settle();
  record({
    id: 'measurement/flush-in-on-settled',
    note: settledError === undefined ? 'flush() in onSettled returned' : `refused: ${settledError}`,
    ok: true,
    threw: settledError !== undefined,
  });
  disposeSettled();

  markDone();
}
