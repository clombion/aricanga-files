/**
 * Performance: render 1,000 messages, then apply 100 snapshot updates through the adapter, each
 * flushed. Two warm-up runs are discarded and the fastest of nine is recorded: the minimum is the
 * intrinsic cost with scheduler noise removed, the stable statistic a regression is judged on.
 */

import { For, createStore, flush, reconcile } from 'solid-js';
import { markDone, record } from '#src/harness';
import type { Message } from '#src/support';
import { render } from '@solidjs/web';

/** The store's state, as the setter's draft is read: it is written only through `reconcile`. */
interface State {
  readonly messages: readonly Message[];
}

/** One run's two timings, in milliseconds. */
interface Timing {
  readonly render: number;
  readonly updates: number;
}

/** Writes the store through the setter the adapter uses. */
type Write = (write: (draft: Readonly<State>) => void) => void;

const MESSAGES = 1000;
const UPDATES = 100;
const WARM_UPS = 2;
const REPETITIONS = 9;

/** Every snapshot is built from the first round's messages. */
const FIRST_ROUND = 0;

/** Updates are numbered from one, consecutively. */
const FIRST_UPDATE = 1;
const NEXT_UPDATE = 1;

/** Each update appends one message to the snapshot. */
const APPENDED_PER_UPDATE = 1;

/**
 * A snapshot's messages.
 * @param {number} round The round the texts name.
 * @returns {Message[]} `MESSAGES` messages with ids `m0`, `m1`, ….
 */
function messages(round: number): Message[] {
  return Array.from({ length: MESSAGES }, (_entry, index) => ({ id: `m${index}`, text: `message ${index} round ${round}` }));
}

/**
 * The smallest of some timings.
 * @param {number[]} values The timings.
 * @returns {number} The fastest.
 */
function fastest(values: readonly number[]): number {
  return Math.min(...values);
}

/**
 * An update's snapshot: the first round's messages with one edited and one appended.
 * @param {number} update The update's number.
 * @returns {Message[]} The snapshot's messages.
 */
function snapshotAt(update: number): Message[] {
  const next = messages(FIRST_ROUND);
  next[update % MESSAGES] = { id: `m${update % MESSAGES}`, text: `edited ${update}` };
  next.push({ id: `n${update}`, text: `appended ${update}` });
  return next;
}

/**
 * The measured work: the first snapshot rendered, then every update built, applied and flushed.
 * @param {Write} setStore The store's setter.
 * @returns {Timing} How long the render and the updates took.
 */
function measured(setStore: Write): Timing {
  const start = performance.now();
  setStore((draft: Readonly<State>) => {
    reconcile(messages(FIRST_ROUND), 'id')(draft.messages);
  });
  flush();
  const rendered = performance.now();
  for (let update = FIRST_UPDATE; update <= UPDATES; update += NEXT_UPDATE) {
    const next = snapshotAt(update);
    setStore((draft: Readonly<State>) => {
      reconcile(next, 'id')(draft.messages);
    });
    flush();
  }
  const updated = performance.now();
  return { render: rendered - start, updates: updated - rendered };
}

/**
 * Refuse a run whose last update did not leave every message and the one appended.
 * @param {number} count The rows the list held after the last update.
 */
function checkRows(count: number): void {
  if (count !== MESSAGES + APPENDED_PER_UPDATE) {
    throw new Error(`expected ${MESSAGES + APPENDED_PER_UPDATE} rows after the last update, found ${count}`);
  }
}

/**
 * One run: a fresh store and list, the measured work, and a check of the rows it left.
 * @returns {Timing} The run's timings.
 */
function once(): Timing {
  const [store, setStore] = createStore<{ messages: Message[] }>({ messages: [] });
  const host = document.createElement('ol');
  document.body.append(host);
  const dispose = render(
    () => <For each={store.messages}>{(message) => <li>{message.text}</li>}</For>,
    host,
  );
  const timing = measured(setStore);
  const count = host.children.length;
  dispose();
  host.remove();
  checkRows(count);
  return timing;
}

/** Discard the warm-ups, then record the fastest render and update times of the repetitions. */
function run(): void {
  Array.from({ length: WARM_UPS }, once);
  const runs = Array.from({ length: REPETITIONS }, once);
  const result = { render: fastest(runs.map((entry) => entry.render)), updates: fastest(runs.map((entry) => entry.updates)) };
  record({ id: 'performance/messages', note: JSON.stringify(result), ok: true, threw: false });
  markDone();
}

export { run };
