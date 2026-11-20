/**
 * The failure model: an error boundary per part contains a throwing part while its siblings stay;
 * what cleanup runs for the throwing branch; and what an uncaught throw does to later updates.
 */

import { Errored, For, createSignal, createStore, flush, onSettled } from 'solid-js';

import { markDone, record } from '../harness';
import { errorText, mount, settle } from '../support';

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

export async function run(): Promise<void> {
  const [store, setStore] = createStore<{ rows: Row[] }>({
    rows: [
      { broken: false, id: 'a', text: 'alpha' },
      { broken: false, id: 'b', text: 'beta' },
    ],
  });
  const { host, dispose } = mount('ul', () => (
    <For each={store.rows}>
      {(row) => (
        <Errored fallback={(error) => <li data-fallback={row.id}>{String(error())}</li>}>
          <Part vm={row} />
        </Errored>
      )}
    </For>
  ));
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
    note: `sibling: ${sibling ?? '<gone>'}; fallback: ${fallback ?? '<none>'}`,
    ok: sibling === 'alpha' && fallback?.includes('part b broke') === true,
    threw: false,
  });
  record({
    id: 'errored/throwing-branch-cleanup',
    note: `settled cleanups run when part b threw: ${settledCleanups - settledBefore}`,
    ok: true,
    threw: false,
  });
  dispose();

  const [broken, setBroken] = createSignal(false);
  const [label, setLabel] = createSignal('first');
  const { host: bare, dispose: disposeBare } = mount('div', () => (
    <p>
      {(() => {
        if (broken()) {
          throw new Error('unbounded throw');
        }
        return label();
      })()}
    </p>
  ));
  flush();
  let uncaught: string | undefined;
  try {
    setBroken(true);
    flush();
  } catch (error) {
    uncaught = errorText(error);
  }
  let later: string | undefined;
  try {
    setLabel('second');
    flush();
  } catch (error) {
    later = errorText(error);
  }
  disposeBare();
  record({
    id: 'errored/unbounded-throw',
    note: `thrown: ${uncaught ?? '<nothing>'}; a later update threw: ${later ?? '<nothing>'}; text after it: ${bare.textContent ?? ''}`,
    ok: true,
    threw: uncaught !== undefined,
  });

  await settle();
  markDone();
}
