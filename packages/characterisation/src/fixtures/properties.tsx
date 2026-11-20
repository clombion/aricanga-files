/**
 * Properties, not attributes: JSX `value`, `checked` and `selected` set DOM properties; the
 * `default…` forms set initial state and leave the current value to the user.
 */

import { createSignal, flush } from 'solid-js';

import { markDone, record } from '../harness';
import { mount } from '../support';

export function run(): void {
  const [text, setText] = createSignal('bound');
  const [on, setOn] = createSignal(true);
  const [initial, setInitial] = createSignal('initial');
  const { host, dispose } = mount('form', () => (
    <>
      <input id="value" value={text()} onInput={(event) => setText(event.currentTarget.value)} />
      <input id="checked" type="checkbox" checked={on()} onChange={(event) => setOn(event.currentTarget.checked)} />
      <select id="selected" onChange={(event) => setOn(event.currentTarget.value === 'b')}>
        <option value="a">a</option>
        <option value="b" selected={on()}>
          b
        </option>
      </select>
      <input id="default" defaultValue={initial()} />
    </>
  ));
  flush();
  const value = host.querySelector<HTMLInputElement>('#value');
  const checked = host.querySelector<HTMLInputElement>('#checked');
  const selected = host.querySelector<HTMLSelectElement>('#selected');
  const fallback = host.querySelector<HTMLInputElement>('#default');
  record({
    id: 'properties/value-is-a-property',
    note: `value property: ${value?.value ?? ''}; value attribute: ${String(value?.getAttribute('value'))}`,
    ok: value?.value === 'bound' && value.getAttribute('value') === null,
    threw: false,
  });
  record({
    id: 'properties/checked-and-selected-are-properties',
    note: `checked property: ${String(checked?.checked)}; checked attribute: ${String(checked?.hasAttribute('checked'))}; select value: ${selected?.value ?? ''}`,
    ok: checked?.checked === true && !checked.hasAttribute('checked') && selected?.value === 'b',
    threw: false,
  });

  if (fallback !== null) {
    fallback.value = 'typed by the user';
  }
  setInitial('changed later');
  flush();
  record({
    id: 'properties/default-value-is-initial-only',
    note: `after a later defaultValue change, value: ${fallback?.value ?? ''}; defaultValue: ${fallback?.defaultValue ?? ''}`,
    ok: fallback?.value === 'typed by the user',
    threw: false,
  });
  setOn(false);
  flush();
  record({
    id: 'properties/checked-follows-the-binding',
    note: `checked after the signal turned false: ${String(checked?.checked)}`,
    ok: checked?.checked === false,
    threw: false,
  });
  dispose();
  markDone();
}
