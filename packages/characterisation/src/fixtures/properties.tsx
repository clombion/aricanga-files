/**
 * Properties, not attributes: JSX `value`, `checked` and `selected` set DOM properties; the
 * `default…` forms set initial state and leave the current value to the user.
 */

import { createSignal, flush } from 'solid-js';
import { markDone, record } from '#src/harness';
import { mount } from '#src/support';

/** An input or select event, read for the field its handler needs. */
type ValueEvent = Readonly<{ currentTarget: Readonly<Pick<HTMLInputElement | HTMLSelectElement, 'value'>> }>;
type CheckedEvent = Readonly<{ currentTarget: Readonly<Pick<HTMLInputElement, 'checked'>> }>;

/** Where the fixture reads the form back. */
type Form = Readonly<Pick<ParentNode, 'querySelector'>>;

/** The mounted form and the writes the fixture drives it with. */
interface MountedForm {
  readonly host: HTMLFormElement;
  readonly dispose: () => void;
  readonly setOn: (on: boolean) => void;
  readonly setInitial: (initial: string) => void;
}

/**
 * Mount a form whose value, checked and selected are bound to signals, with a `defaultValue` field.
 * @returns {MountedForm} The form and its writes.
 */
function mountedForm(): MountedForm {
  const [text, setText] = createSignal('bound');
  const [on, setOn] = createSignal(true);
  const [initial, setInitial] = createSignal('initial');
  const { host, dispose } = mount('form', () => (
    <>
      <input id="value" value={text()} onInput={(event: ValueEvent) => { setText(event.currentTarget.value); }} />
      <input id="checked" type="checkbox" checked={on()} onChange={(event: CheckedEvent) => { setOn(event.currentTarget.checked); }} />
      <select id="selected" onChange={(event: ValueEvent) => { setOn(event.currentTarget.value === 'b'); }}>
        <option value="a">a</option>
        <option value="b" selected={on()}>
          b
        </option>
      </select>
      <input id="default" defaultValue={initial()} />
    </>
  ));
  return {
    dispose,
    host,
    setInitial: (next: string): void => {
      setInitial(next);
    },
    setOn: (next: boolean): void => {
      setOn(next);
    },
  };
}

/**
 * Record that `value`, `checked` and `selected` landed as properties and not attributes.
 * @param {ParentNode} form The mounted form.
 */
function recordBoundProperties(form: Form): void {
  const value = form.querySelector<HTMLInputElement>('#value');
  const checked = form.querySelector<HTMLInputElement>('#checked');
  const selected = form.querySelector<HTMLSelectElement>('#selected');
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
}

/**
 * Type into the `defaultValue` field, change its bound default, and record that the typed value stays.
 * @param {ParentNode} form The mounted form.
 * @param {Function} setInitial Writes the bound default.
 */
function recordDefaultValue(form: Form, setInitial: (initial: string) => void): void {
  const fallback = form.querySelector<HTMLInputElement>('#default');
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
}

/**
 * Turn the bound signal off and record that `checked` follows it.
 * @param {ParentNode} form The mounted form.
 * @param {Function} setOn Writes the bound checked state.
 */
function recordCheckedFollows(form: Form, setOn: (on: boolean) => void): void {
  const checked = form.querySelector<HTMLInputElement>('#checked');
  setOn(false);
  flush();
  record({
    id: 'properties/checked-follows-the-binding',
    note: `checked after the signal turned false: ${String(checked?.checked)}`,
    ok: checked?.checked === false,
    threw: false,
  });
}

/** Mount the form and record each property observation. */
function run(): void {
  const form = mountedForm();
  flush();
  recordBoundProperties(form.host);
  recordDefaultValue(form.host, form.setInitial);
  recordCheckedFollows(form.host, form.setOn);
  form.dispose();
  markDone();
}

export { run };
