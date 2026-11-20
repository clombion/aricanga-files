/**
 * Performance: render 1,000 messages, then apply 100 snapshot updates through the adapter, each
 * flushed. The median of five repetitions is recorded; the spec compares it with the baseline.
 */

import { render } from '@solidjs/web';
import { createStore, flush, For, reconcile } from 'solid-js';

import { markDone, record } from '../harness';

interface Message {
  readonly id: string;
  readonly text: string;
}

const MESSAGES = 1000;
const UPDATES = 100;
const REPETITIONS = 5;

function messages(round: number): Message[] {
  return Array.from({ length: MESSAGES }, (_, index) => ({ id: `m${index}`, text: `message ${index} round ${round}` }));
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
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
  const runs = Array.from({ length: REPETITIONS }, once);
  const result = { render: median(runs.map((entry) => entry.render)), updates: median(runs.map((entry) => entry.updates)) };
  record({ id: 'performance/messages', ok: true, threw: false, note: JSON.stringify(result) });
  markDone();
}
