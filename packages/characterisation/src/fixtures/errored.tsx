/**
 * The failure model: an error boundary per part contains a throwing part while its siblings stay;
 * what cleanup runs for the throwing branch; and what an uncaught throw does to later updates.
 */

import { Errored, For, createSignal, createStore, flush, onSettled, reconcile } from 'solid-js';
import { errorText, mount, settle } from '#src/support';
import { markDone, record } from '#src/harness';
import type { JSX } from '@solidjs/web';

/** One part's view-model. */
interface Row {
  readonly id: string;
  readonly text: string;
  readonly broken: boolean;
}

/** The store's state, as the setter's draft is read: it is written only through `reconcile`. */
interface State {
  readonly rows: readonly Row[];
}

/** The two rows, the second of which breaks on the update. */
const HEALTHY: readonly Row[] = [
  { broken: false, id: 'a', text: 'alpha' },
  { broken: false, id: 'b', text: 'beta' },
];

/** The same rows after the update: row b now throws when it renders. */
const B_BROKEN: readonly Row[] = [
  { broken: false, id: 'a', text: 'alpha' },
  { broken: true, id: 'b', text: 'beta' },
];

/** One settled cleanup. */
const ONE = 1;

/**
 * A part that counts its settled cleanups and throws while its row is broken.
 * @param {Function} cleaned Called when the part's settled cleanup runs.
 * @returns {Function} The part.
 */
function partCounting(cleaned: () => void): (props: Readonly<{ vm: Row }>) => JSX.Element {
  return (props) => {
    onSettled(() => cleaned);
    return (
      <li data-id={props.vm.id}>
        {((): string => {
          if (props.vm.broken) {
            throw new Error(`part ${props.vm.id} broke`);
          }
          return props.vm.text;
        })()}
      </li>
    );
  };
}

/** The rows mounted behind a boundary each, and the write that breaks row b. */
interface MountedRows {
  readonly host: HTMLElement;
  readonly dispose: () => void;
  readonly breakRowB: () => void;
}

/**
 * Mount each row's part behind its own boundary.
 * @param {Function} Part The part to render per row.
 * @returns {MountedRows} The mounted list and the write that breaks row b.
 */
function mountedRows(Part: (props: Readonly<{ vm: Row }>) => JSX.Element): MountedRows {
  const [store, setStore] = createStore<{ rows: Row[] }>({ rows: [...HEALTHY] });
  const { host, dispose } = mount('ul', () => (
    <For each={store.rows}>
      {(row) => (
        <Errored fallback={(error) => <li data-fallback={row.id}>{String(error())}</li>}>
          <Part vm={row} />
        </Errored>
      )}
    </For>
  ));
  return {
    breakRowB: (): void => {
      setStore((draft: Readonly<State>) => {
        reconcile([...B_BROKEN], 'id')(draft.rows);
      });
    },
    dispose,
    host,
  };
}

/**
 * Record whether the sibling kept rendering, the broken part's fallback rendered, and its cleanups.
 * @param {ParentNode} host The list.
 * @param {number} cleanedSinceBreak The settled cleanups that ran after row b broke.
 */
function recordContained(host: Readonly<Pick<ParentNode, 'querySelector'>>, cleanedSinceBreak: number): void {
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
    note: `settled cleanups run when part b threw: ${cleanedSinceBreak}`,
    ok: true,
    threw: false,
  });
}

/** Break one part behind its own boundary and record what its sibling and its cleanup did. */
async function recordContainedThrow(): Promise<void> {
  const cleanups = { count: 0 };
  const rows = mountedRows(
    partCounting(() => {
      cleanups.count += ONE;
    }),
  );
  flush();
  await settle();
  const settledBefore = cleanups.count;
  rows.breakRowB();
  flush();
  await settle();
  recordContained(rows.host, cleanups.count - settledBefore);
  rows.dispose();
}

/**
 * Run an update and report what its flush threw, if anything.
 * @param {Function} update The write to flush.
 * @returns {string | undefined} The thrown message, or undefined when the flush returned.
 */
function flushed(update: () => void): string | undefined {
  try {
    update();
    flush();
    return undefined;
  } catch (error) {
    return errorText(error);
  }
}

/** Throw with no boundary, then update again, and record both flushes and what rendered. */
function recordUnboundedThrow(): void {
  const [broken, setBroken] = createSignal(false);
  const [label, setLabel] = createSignal('first');
  const { host, dispose } = mount('div', () => (
    <p>
      {((): string => {
        if (broken()) {
          throw new Error('unbounded throw');
        }
        return label();
      })()}
    </p>
  ));
  flush();
  const uncaught = flushed(() => {
    setBroken(true);
  });
  const later = flushed(() => {
    setLabel('second');
  });
  dispose();
  record({
    id: 'errored/unbounded-throw',
    note: `thrown: ${uncaught ?? '<nothing>'}; a later update threw: ${later ?? '<nothing>'}; text after it: ${host.textContent}`,
    ok: true,
    threw: uncaught !== undefined,
  });
}

/** Record the contained throw, then the unbounded one. */
async function run(): Promise<void> {
  await recordContainedThrow();
  recordUnboundedThrow();
  await settle();
  markDone();
}

export { run };
