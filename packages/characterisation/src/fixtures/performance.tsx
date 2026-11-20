/**
 * Performance: render 1,000 messages, then apply 100 snapshot updates through the adapter, each
 * flushed. Two warm-up runs are discarded and the fastest of nine is recorded: the minimum is the
 * intrinsic cost with scheduler noise removed, the stable statistic a regression is judged on.
 */

import { render } from '@solidjs/web';
import { For, createStore, flush, reconcile } from 'solid-js';

import { markDone, record } from '../harness';
import type { Message } from '../support';

const MESSAGES = 1000;
const UPDATES = 100;
const WARM_UPS = 2;
const REPETITIONS = 9;

function messages(round: number): Message[] {
  return Array.from({ length: MESSAGES }, (_, index) => ({ id: `m${index}`, text: `message ${index} round ${round}` }));
}

function fastest(values: readonly number[]): number {
  return Math.min(...values);
}

function once(): { readonly render: number; readonly updates: number } {
  const [store, setStore] = createStore<{ messages: Message[] }>({ messages: [] });
  const host = document.createElement('ol');
  document.body.append(host);
  const dispose = render(
    () => <For each={store.messages}>{(message) => <li>{message.text}</li>}</For>,
    host,
  );
  const start = performance.now();
  setStore((draft) => {
    reconcile(messages(0), 'id')(draft.messages);
  });
  flush();
  const rendered = performance.now();
  for (let update = 1; update <= UPDATES; update += 1) {
    const next = messages(0);
    next[update % MESSAGES] = { id: `m${update % MESSAGES}`, text: `edited ${update}` };
    next.push({ id: `n${update}`, text: `appended ${update}` });
    setStore((draft) => {
      reconcile(next, 'id')(draft.messages);
    });
    flush();
  }
  const updated = performance.now();
  const count = host.children.length;
  dispose();
  host.remove();
  if (count !== MESSAGES + 1) {
    throw new Error(`expected ${MESSAGES + 1} rows after the last update, found ${count}`);
  }
  return { render: rendered - start, updates: updated - rendered };
}

export function run(): void {
  Array.from({ length: WARM_UPS }, once);
  const runs = Array.from({ length: REPETITIONS }, once);
  const result = { render: fastest(runs.map((entry) => entry.render)), updates: fastest(runs.map((entry) => entry.updates)) };
  record({ id: 'performance/messages', note: JSON.stringify(result), ok: true, threw: false });
  markDone();
}
