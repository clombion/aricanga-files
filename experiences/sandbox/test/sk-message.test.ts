// The message element's lifecycle in happy-dom: it renders its part into its shadow root on connect,
// follows a new view-model, and disposes the root on disconnect. The real-browser proof is the
// sandbox's Playwright spec, `experiences/sandbox/test/sk-message.spec.ts`.

import { SkMessage, defineSkMessage } from '#parts/sk-message';
import { describe, expect, test } from 'vitest';
import { flush } from 'solid-js';

/**
 * A registered message element showing `text`, connected and rendered.
 * @param {string} text The text it shows.
 * @returns {SkMessage} The element.
 */
function connected(text: string): SkMessage {
  defineSkMessage();
  const element = new SkMessage();
  element.show({ text });
  document.body.append(element);
  flush();
  return element;
}

/**
 * The text of the bubble a part rendered into a shadow root, or `undefined` when it shows none.
 * @param {ParentNode | null} root The element's shadow root.
 * @returns {string | undefined} The bubble's text.
 */
function bubbleText(root: Readonly<Pick<ParentNode, 'querySelector'>> | null): string | undefined {
  return root?.querySelector('p[part="bubble"]')?.textContent ?? undefined;
}

describe('sk-message', () => {
  test('registers once and renders its part into its shadow root', () => {
    expect.hasAssertions();
    const element = connected('hello');
    defineSkMessage();
    expect(customElements.get('sk-message')).toBe(SkMessage);
    expect(bubbleText(element.shadowRoot)).toBe('hello');
  });

  test('a new view-model updates the text', () => {
    expect.hasAssertions();
    const element = connected('hello');
    element.show({ text: 'world' });
    flush();
    expect(bubbleText(element.shadowRoot)).toBe('world');
  });

  test('disconnecting disposes the root, and reconnecting renders it afresh', () => {
    expect.hasAssertions();
    const element = connected('hello');
    element.remove();
    flush();
    expect(element.shadowRoot?.hasChildNodes()).toBe(false);
    document.body.append(element);
    flush();
    expect(bubbleText(element.shadowRoot)).toBe('hello');
  });
});
