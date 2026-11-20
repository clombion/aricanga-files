// Component test in happy-dom: the render proof for the Lit baseline, which #24
// replaces with a Solid part.

import { SkMessage, defineSkMessage } from '#src/sk-message';
import { describe, expect, test } from 'vitest';

/**
 * A registered message element showing `text`, connected and rendered.
 * @param {string} text The text it shows.
 * @returns {Promise<SkMessage>} The element.
 */
async function connected(text: string): Promise<SkMessage> {
  defineSkMessage();
  const element = new SkMessage();
  element.text = text;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe('sk-message', () => {
  test('registers and renders into shadow DOM', async () => {
    expect.hasAssertions();
    const element = await connected('hello');
    // AC #4: registered.
    expect(customElements.get('sk-message')).toBe(SkMessage);
    // AC #1: rendered into the shadow root.
    expect(element.shadowRoot?.querySelector('p')?.textContent).toBe('hello');
  });

  test('reacts to a change of its text', async () => {
    expect.hasAssertions();
    const element = await connected('hello');
    element.text = 'world';
    await element.updateComplete;
    // AC #2: reactive.
    expect(element.shadowRoot?.querySelector('p')?.textContent).toBe('world');
  });
});
