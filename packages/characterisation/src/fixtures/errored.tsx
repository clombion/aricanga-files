/**
 * The failure model: an error boundary per part contains a throwing part while its siblings stay;
 * what cleanup runs for the throwing branch; and what an uncaught throw does to later updates.
 */

import { render } from '@solidjs/web';
import { createSignal, createStore, Errored, flush, For, onSettled } from 'solid-js';

import { markDone, record } from '../harness';

/** The store's own state: its draft is written in place. */
interface Row {
  id: string;
  text: string;
  broken: boolean;
}

let settledCleanups = 0;

function Part(props: { readonly vm: Row }) {
  onSettled(() => () => {
    settledCleanups += 1;
  });
  return (
    <li data-id={props.vm.id}>
      {(() => {
        if (props.vm.broken) {
          throw new Error(`part ${props.vm.id} broke`);
        }
        return props.vm.text;
      })()}
    </li>
  );
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export async function run(): Promise<void> {
  const [store, setStore] = createStore<{ rows: Row[] }>({
    rows: [
      { id: 'a', text: 'alpha', broken: false },
      { id: 'b', text: 'beta', broken: false },
    ],
  });
  const host = document.createElement('ul');
  document.body.append(host);
  const dispose = render(
    () => (
      <For each={store.rows}>
        {(row) => (
          <Errored fallback={(error) => <li data-fallback={row.id}>{String(error())}</li>}>
            <Part vm={row} />
          </Errored>
        )}
      </For>
    ),
    host,
  );
  flush();
  await settle();
  const settledBefore = settledCleanups;

  setStore((draft) => {
    const second = draft.rows[1];
    if (second !== undefined) {
      second.broken = true;
    }
  });
  flush();
  await settle();

  const sibling = host.querySelector('li[data-id="a"]')?.textContent;
  const fallback = host.querySelector('li[data-fallback="b"]')?.textContent;
  record({
    id: 'errored/part-boundary-contains-a-throw',
    ok: sibling === 'alpha' && fallback?.includes('part b broke') === true,
    threw: false,
    note: `sibling: ${sibling ?? '<gone>'}; fallback: ${fallback ?? '<none>'}`,
  });
  record({
    id: 'errored/throwing-branch-cleanup',
    ok: true,
    threw: false,
    note: `settled cleanups run when part b threw: ${settledCleanups - settledBefore}`,
  });
  dispose();
  host.remove();

  const bare = document.createElement('div');
  document.body.append(bare);
  const [broken, setBroken] = createSignal(false);
  const [label, setLabel] = createSignal('first');
  const disposeBare = render(
    () => (
      <p>
        {(() => {
          if (broken()) {
            throw new Error('unbounded throw');
          }
          return label();
        })()}
      </p>
    ),
    bare,
  );
  flush();
  let uncaught: string | undefined;
  try {
    setBroken(true);
    flush();
  } catch (error) {
    uncaught = error instanceof Error ? error.message : String(error);
  }
  let later: string | undefined;
  try {
    setLabel('second');
    flush();
  } catch (error) {
    later = error instanceof Error ? error.message : String(error);
  }
  disposeBare();
  record({
    id: 'errored/unbounded-throw',
    ok: true,
    threw: uncaught !== undefined,
    note: `thrown: ${uncaught ?? '<nothing>'}; a later update threw: ${later ?? '<nothing>'}; text after it: ${bare.textContent ?? ''}`,
  });
  bare.remove();

  await settle();
  markDone();
}
