/** Props: a part's single `vm` prop, read without destructuring, stays reactive; a destructured one does not. */

import { createStore, flush } from 'solid-js';

import { markDone, record } from '../harness';
import { mount } from '../support';

/** The store's own state: its draft is written in place. */
interface Bubble {
  text: string;
}

function Read(props: { readonly vm: Bubble }) {
  return <p id="read">{props.vm.text}</p>;
}

// The shape the vm-prop lint rule refuses, kept here as the runtime evidence for that rule.
// oxlint-disable-next-line solid/no-destructure -- the planted destructured part whose staleness this fixture records
function Destructured({ vm }: { readonly vm: Bubble }) {
  return <p id="destructured">{vm.text}</p>;
}

export function run(): void {
  const [store, setStore] = createStore<{ bubble: Bubble }>({ bubble: { text: 'before' } });
  const { host, dispose } = mount('div', () => (
    <>
      <Read vm={store.bubble} />
      <Destructured vm={store.bubble} />
    </>
  ));
  flush();
  setStore((draft) => {
    draft.bubble.text = 'after';
  });
  flush();
  const read = host.querySelector('#read')?.textContent;
  const destructured = host.querySelector('#destructured')?.textContent;
  record({
    id: 'props/single-vm-prop-is-reactive',
    note: `a field change, read through props: ${read ?? ''}; destructured: ${destructured ?? ''}`,
    ok: read === 'after',
    threw: false,
  });
  setStore((draft) => {
    draft.bubble = { text: 'a new vm' };
  });
  flush();
  const readNew = host.querySelector('#read')?.textContent;
  const destructuredNew = host.querySelector('#destructured')?.textContent;
  record({
    id: 'props/new-vm-reaches-only-the-undestructured-part',
    note: `a new vm object, read through props: ${readNew ?? ''}; destructured: ${destructuredNew ?? ''}`,
    ok: readNew === 'a new vm',
    threw: false,
  });
  dispose();
  markDone();
}
