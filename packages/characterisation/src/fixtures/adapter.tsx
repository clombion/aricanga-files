/**
 * The snapshot adapter: one store per mounted experience, reconciled by id from outside any reactive
 * scope, including from a timer; and a write from inside an owned scope.
 */

import { render } from '@solidjs/web';
import { createMemo, createRoot, createStore, flush, For, reconcile } from 'solid-js';

import { markDone, record } from '../harness';
import { errorText, type Message, mount, settle } from '../support';

interface Snapshot {
  readonly messages: readonly Message[];
}

export async function run(): Promise<void> {
  const [store, setStore] = createStore<{ messages: Message[] }>({ messages: [] });
  const apply = (snapshot: Snapshot): void => {
    setStore((draft) => {
      reconcile([...snapshot.messages], 'id')(draft.messages);
    });
  };

  const { host, dispose } = mount('div', () => (
    <ul>
      <For each={store.messages}>{(message) => <li data-id={message.id}>{message.text}</li>}</For>
    </ul>
  ));

  apply({ messages: [{ id: 'a', text: 'one' }, { id: 'b', text: 'two' }, { id: 'c', text: 'three' }] });
  flush();
  const before = new Map([...host.querySelectorAll('li')].map((li) => [li.dataset['id'], li]));

  apply({ messages: [{ id: 'a', text: 'one' }, { id: 'b', text: 'TWO' }, { id: 'c', text: 'three' }, { id: 'd', text: 'four' }] });
  flush();
  const after = new Map([...host.querySelectorAll('li')].map((li) => [li.dataset['id'], li]));
  const kept = ['a', 'b', 'c'].every((id) => before.get(id) === after.get(id));
  record({
    id: 'adapter/reconcile-keeps-nodes-by-id',
    ok: kept && after.get('b')?.textContent === 'TWO' && after.size === 4,
    threw: false,
    note: `nodes kept for a,b,c: ${String(kept)}; b text: ${after.get('b')?.textContent ?? '<none>'}; items: ${after.size}`,
  });

  await new Promise<void>((resolve) => {
    setTimeout(() => {
      apply({ messages: [{ id: 'a', text: 'from a timer' }] });
      flush();
      resolve();
    }, 0);
  });
  record({
    id: 'adapter/apply-from-timer',
    ok: host.querySelector('li')?.textContent === 'from a timer' && host.querySelectorAll('li').length === 1,
    threw: false,
    note: `after a timer apply: ${host.textContent ?? ''}`,
  });
  dispose();

  let bodyError: string | undefined;
  const bodyHost = document.createElement('div');
  document.body.append(bodyHost);
  try {
    const disposeBody = render(() => {
      apply({ messages: [{ id: 'x', text: 'written in a component body' }] });
      return <p>body</p>;
    }, bodyHost);
    disposeBody();
  } catch (error) {
    bodyError = errorText(error);
  }
  bodyHost.remove();
  record({
    id: 'adapter/write-in-component-body-refused',
    ok: bodyError !== undefined,
    threw: bodyError !== undefined,
    ...(bodyError === undefined ? { note: 'a store write in a component body was allowed' } : { error: bodyError }),
  });

  let computeError: string | undefined;
  createRoot((disposeRoot) => {
    try {
      const written = createMemo(() => {
        apply({ messages: [{ id: 'y', text: 'written in a memo' }] });
        return 0;
      });
      // oxlint-disable-next-line solid/reactivity -- the read forces the planted memo to compute
      written();
      flush();
    } catch (error) {
      computeError = errorText(error);
    }
    disposeRoot();
  });
  record({
    id: 'adapter/write-in-memo-refused',
    ok: computeError !== undefined,
    threw: computeError !== undefined,
    ...(computeError === undefined ? { note: 'a store write in a memo was allowed' } : { error: computeError }),
  });

  await settle();
  markDone();
}
