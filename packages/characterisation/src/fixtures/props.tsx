/** Props: a part's single `vm` prop, read without destructuring, stays reactive; a destructured one does not. */

import { createStore, flush, reconcile } from 'solid-js';
import { markDone, record } from '#src/harness';
import type { JSX } from '@solidjs/web';
import { mount } from '#src/support';

/** One part's view-model. */
interface Bubble {
  readonly text: string;
}

/** The store's state, as the setter's draft is read. */
interface State {
  readonly bubble: Bubble;
}

/** Where the fixture reads the parts back. */
type Parts = Readonly<Pick<ParentNode, 'querySelector'>>;

/**
 * A part reading its vm through props.
 * @param {object} props The part's props.
 * @returns {JSX.Element} The vm's text.
 */
function Read(props: Readonly<{ vm: Bubble }>): JSX.Element {
  return <p id="read">{props.vm.text}</p>;
}

// The shape the vm-prop lint rule refuses, kept here as the runtime evidence for that rule.
/**
 * A part that destructures its vm.
 * @param {object} root0 The part's props, destructured.
 * @param {Bubble} root0.vm The vm, read once when the part runs.
 * @returns {JSX.Element} The vm's text, as read when the part ran.
 */
// oxlint-disable-next-line solid/no-destructure -- the planted destructured part whose staleness this fixture records
function Destructured({ vm }: Readonly<{ vm: Bubble }>): JSX.Element {
  return <p id="destructured">{vm.text}</p>;
}

/**
 * The text each part shows.
 * @param {ParentNode} parts The mounted parts.
 * @returns {string} Both texts, for the record's note.
 */
function shown(parts: Parts): { readonly read: string | undefined; readonly destructured: string | undefined } {
  return {
    destructured: parts.querySelector('#destructured')?.textContent,
    read: parts.querySelector('#read')?.textContent,
  };
}

/** One observation: the record's id, the change as the note names it, and what `Read` must show. */
interface Observation {
  readonly id: string;
  readonly change: string;
  readonly expected: string;
}

/**
 * Record what each part shows after a change.
 * @param {ParentNode} parts The mounted parts.
 * @param {Observation} observation What is recorded and expected.
 */
function recordShown(parts: Parts, observation: Observation): void {
  const now = shown(parts);
  record({
    id: observation.id,
    note: `${observation.change}, read through props: ${now.read ?? ''}; destructured: ${now.destructured ?? ''}`,
    ok: now.read === observation.expected,
    threw: false,
  });
}

/**
 * Write the store, flush, and record what each part shows.
 * @param {ParentNode} parts The mounted parts.
 * @param {Function} write The store write.
 * @param {Observation} observation What is recorded and expected.
 */
function afterWrite(parts: Parts, write: () => void, observation: Observation): void {
  write();
  flush();
  recordShown(parts, observation);
}

/** Change the vm's field in place, then replace the vm, recording what each part shows after each. */
function run(): void {
  const [store, setStore] = createStore<{ bubble: Bubble }>({ bubble: { text: 'before' } });
  const { host, dispose } = mount('div', () => (
    <>
      <Read vm={store.bubble} />
      <Destructured vm={store.bubble} />
    </>
  ));
  flush();
  // A field change: reconcile writes the new text into the same vm object.
  afterWrite(
    host,
    () => {
      setStore((draft: Readonly<State>) => {
        reconcile({ text: 'after' })(draft.bubble);
      });
    },
    { change: 'a field change', expected: 'after', id: 'props/single-vm-prop-is-reactive' },
  );
  // A new vm object: the setter's returned state replaces the bubble at the top level.
  afterWrite(
    host,
    () => {
      setStore(() => ({ bubble: { text: 'a new vm' } }));
    },
    { change: 'a new vm object', expected: 'a new vm', id: 'props/new-vm-reaches-only-the-undestructured-part' },
  );
  dispose();
  markDone();
}

export { run };
