/**
 * Measurement: a snapshot applied outside reactive scope is visible to layout only after `flush()`;
 * what `flush()` does inside an effect callback and inside `onSettled`.
 */

import { render } from '@solidjs/web';
import { createEffect, createRoot, createSignal, createStore, flush, onSettled } from 'solid-js';

import { markDone, record } from '../harness';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function run(): Promise<void> {
  const [store, setStore] = createStore({ text: 'short' });
  const host = document.createElement('div');
  document.body.append(host);
  const dispose = render(() => <p id="measured">{store.text}</p>, host);
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
    ok: beforeFlush === 'short' && afterFlush?.startsWith('a much longer') === true && width > 0,
    threw: false,
    note: `before flush: ${beforeFlush ?? ''}; after flush: ${afterFlush ?? ''}; width ${width}`,
  });
  dispose();
  host.remove();

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
    ok: true,
    threw: effectError !== undefined,
    note: effectError === undefined ? 'flush() in an effect callback returned' : `refused: ${effectError}`,
  });

  let settledError: string | undefined;
  const settledHost = document.createElement('div');
  document.body.append(settledHost);
  const disposeSettled = render(() => {
    onSettled(() => {
      try {
        flush();
      } catch (error) {
        settledError = errorText(error);
      }
    });
    return <p>settled</p>;
  }, settledHost);
  flush();
  await settle();
  record({
    id: 'measurement/flush-in-on-settled',
    ok: true,
    threw: settledError !== undefined,
    note: settledError === undefined ? 'flush() in onSettled returned' : `refused: ${settledError}`,
  });
  disposeSettled();
  settledHost.remove();

  markDone();
}
