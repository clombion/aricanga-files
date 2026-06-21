import { expect, test } from 'vitest';
import { SkMessage } from './sk-message';

// Component test in happy-dom (task-004 AC #2) — also the render proof for the
// Lit baseline (task-003 AC #1, #2, #4).
test('sk-message registers, renders into shadow DOM, and reacts to changes', async () => {
  const el = new SkMessage();
  el.text = 'hello';
  document.body.appendChild(el);
  await el.updateComplete;

  expect(customElements.get('sk-message')).toBeTruthy(); // AC #4 registered
  expect(el.shadowRoot?.querySelector('p')?.textContent).toBe('hello'); // AC #1 shadow render

  el.text = 'world';
  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('p')?.textContent).toBe('world'); // AC #2 reactive
});
