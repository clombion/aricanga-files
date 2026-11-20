/**
 * Properties, not attributes: JSX `value`, `checked` and `selected` set DOM properties; the
 * `default…` forms set initial state and leave the current value to the user.
 */

import { render } from '@solidjs/web';
import { createSignal, flush } from 'solid-js';

import { markDone, record } from '../harness';

export function run(): void {
  const [text, setText] = createSignal('bound');
  const [on, setOn] = createSignal(true);
  const [initial, setInitial] = createSignal('initial');
  const host = document.createElement('form');
  document.body.append(host);
  const dispose = render(
    () => (
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
    ),
    host,
  );
  flush();
  const value = host.querySelector<HTMLInputElement>('#value');
  const checked = host.querySelector<HTMLInputElement>('#checked');
  const selected = host.querySelector<HTMLSelectElement>('#selected');
  const fallback = host.querySelector<HTMLInputElement>('#default');
  record({
    id: 'properties/value-is-a-property',
    ok: value?.value === 'bound' && value.getAttribute('value') === null,
    threw: false,
    note: `value property: ${value?.value ?? ''}; value attribute: ${String(value?.getAttribute('value'))}`,
  });
  record({
    id: 'properties/checked-and-selected-are-properties',
    ok: checked?.checked === true && !checked.hasAttribute('checked') && selected?.value === 'b',
    threw: false,
    note: `checked property: ${String(checked?.checked)}; checked attribute: ${String(checked?.hasAttribute('checked'))}; select value: ${selected?.value ?? ''}`,
  });

  if (fallback !== null) {
    fallback.value = 'typed by the user';
  }
  setInitial('changed later');
  flush();
  record({
    id: 'properties/default-value-is-initial-only',
    ok: fallback?.value === 'typed by the user',
    threw: false,
    note: `after a later defaultValue change, value: ${fallback?.value ?? ''}; defaultValue: ${fallback?.defaultValue ?? ''}`,
  });
  setOn(false);
  flush();
  record({
    id: 'properties/checked-follows-the-binding',
    ok: checked?.checked === false,
    threw: false,
    note: `checked after the signal turned false: ${String(checked?.checked)}`,
  });
  dispose();
  host.remove();
  markDone();
}
