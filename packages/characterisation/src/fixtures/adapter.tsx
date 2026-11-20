/**
 * The snapshot adapter: one store per mounted experience, reconciled by id from outside any reactive
 * scope, including from a timer; and a write from inside an owned scope.
 */

import { For, createMemo, createRoot, createStore, flush, reconcile } from 'solid-js';
import { errorText, mount, settle } from '#src/support';
import { markDone, record } from '#src/harness';
import type { Message } from '#src/support';
import { render } from '@solidjs/web';

/** A snapshot as the host hands it to the adapter. */
interface Snapshot {
  readonly messages: readonly Message[];
}

/** The adapter's store, as the setter's draft is read: it is written only through `reconcile`. */
interface State {
  readonly messages: readonly Message[];
}

/** A store and the one function that writes it. */
interface Adapter {
  readonly messages: () => readonly Message[];
  readonly apply: (snapshot: Snapshot) => void;
}

/** The items the second snapshot holds: the first three, one edited, and one new. */
const ITEMS_AFTER_UPDATE = 4;

/** The items the timer's snapshot holds. */
const ITEMS_AFTER_TIMER = 1;

/** The timer's delay: the next macrotask. */
const NEXT_MACROTASK = 0;

/** What the planted memo computes; only where it writes matters. */
const PLANTED_VALUE = 'planted';

/**
 * A store reconciled by id from each snapshot.
 * @returns {Adapter} The store's reader and its writer.
 */
function adapter(): Adapter {
  const [store, setStore] = createStore<{ messages: Message[] }>({ messages: [] });
  return {
    apply: (snapshot: Snapshot): void => {
      setStore((draft: Readonly<State>) => {
        reconcile([...snapshot.messages], 'id')(draft.messages);
      });
    },
    messages: () => store.messages,
  };
}

/**
 * The rendered list items of a host, by their `data-id`.
 * @param {ParentNode} host The element holding the list.
 * @returns {Map<string | undefined, HTMLLIElement>} Each item, keyed by its id.
 */
function itemsById(host: Readonly<Pick<ParentNode, 'querySelectorAll'>>): Map<string | undefined, HTMLLIElement> {
  const items = new Map<string | undefined, HTMLLIElement>();
  for (const item of host.querySelectorAll('li')) {
    items.set(item.dataset['id'], item);
  }
  return items;
}

/**
 * Apply two snapshots and record whether the items whose ids persist kept their nodes.
 * @param {Adapter} store The adapter.
 * @param {HTMLElement} host The element the list is rendered into.
 */
function recordReconcile(store: Adapter, host: Readonly<Pick<ParentNode, 'querySelectorAll'>>): void {
  store.apply({
    messages: [
      { id: 'a', text: 'one' },
      { id: 'b', text: 'two' },
      { id: 'c', text: 'three' },
    ],
  });
  flush();
  const before = itemsById(host);
  store.apply({
    messages: [
      { id: 'a', text: 'one' },
      { id: 'b', text: 'TWO' },
      { id: 'c', text: 'three' },
      { id: 'd', text: 'four' },
    ],
  });
  flush();
  const after = itemsById(host);
  const kept = ['a', 'b', 'c'].every((id) => before.get(id) === after.get(id));
  record({
    id: 'adapter/reconcile-keeps-nodes-by-id',
    note: `nodes kept for a,b,c: ${String(kept)}; b text: ${after.get('b')?.textContent ?? '<none>'}; items: ${after.size}`,
    ok: kept && after.get('b')?.textContent === 'TWO' && after.size === ITEMS_AFTER_UPDATE,
    threw: false,
  });
}

/**
 * Apply a snapshot from a timer callback, flush there, and resolve once it has: the wait's own
 * timer is queued after the apply's, so it fires after it.
 * @param {Adapter} store The adapter.
 * @returns {Promise<void>} Resolves after the timer applied the snapshot.
 */
async function applyFromTimer(store: Adapter): Promise<void> {
  setTimeout(() => {
    store.apply({ messages: [{ id: 'a', text: 'from a timer' }] });
    flush();
  }, NEXT_MACROTASK);
  await settle(NEXT_MACROTASK);
}

/**
 * Write the store from a memo and record whether it was refused.
 * @param {Adapter} store The adapter.
 */
function recordMemoWrite(store: Adapter): void {
  const memo: { error?: string } = {};
  createRoot((disposeRoot) => {
    try {
      const written = createMemo(() => {
        store.apply({ messages: [{ id: 'y', text: 'written in a memo' }] });
        return PLANTED_VALUE;
      });
      // oxlint-disable-next-line solid/reactivity -- the read forces the planted memo to compute
      written();
      flush();
    } catch (error) {
      memo.error = errorText(error);
    }
    disposeRoot();
  });
  record({
    id: 'adapter/write-in-memo-refused',
    ok: memo.error !== undefined,
    threw: memo.error !== undefined,
    ...(memo.error === undefined ? { note: 'a store write in a memo was allowed' } : { error: memo.error }),
  });
}

/**
 * Write the store from a component body and from a memo, and record whether each was refused.
 * @param {Adapter} store The adapter.
 */
function recordOwnedWrites(store: Adapter): void {
  const body: { error?: string } = {};
  const bodyHost = document.createElement('div');
  document.body.append(bodyHost);
  try {
    const disposeBody = render(() => {
      store.apply({ messages: [{ id: 'x', text: 'written in a component body' }] });
      return <p>body</p>;
    }, bodyHost);
    disposeBody();
  } catch (error) {
    body.error = errorText(error);
  }
  bodyHost.remove();
  record({
    id: 'adapter/write-in-component-body-refused',
    ok: body.error !== undefined,
    threw: body.error !== undefined,
    ...(body.error === undefined ? { note: 'a store write in a component body was allowed' } : { error: body.error }),
  });
  recordMemoWrite(store);
}

/** Reconcile by id, apply from a timer, and write from owned scopes; record each. */
async function run(): Promise<void> {
  const store = adapter();
  const { host, dispose } = mount('div', () => (
    <ul>
      <For each={store.messages()}>{(message) => <li data-id={message.id}>{message.text}</li>}</For>
    </ul>
  ));
  recordReconcile(store, host);
  await applyFromTimer(store);
  record({
    id: 'adapter/apply-from-timer',
    note: `after a timer apply: ${host.textContent}`,
    ok: host.querySelector('li')?.textContent === 'from a timer' && host.querySelectorAll('li').length === ITEMS_AFTER_TIMER,
    threw: false,
  });
  dispose();
  recordOwnedWrites(store);
  await settle();
  markDone();
}

export { run };
