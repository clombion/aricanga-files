// End-to-end smoke for the walking skeleton: ink compiles,
// flows through the stub reduce, and renders as a Lit component in the DOM.

import { describe, expect, test } from 'vitest';
import { SkMessage } from '#src/sk-message';
import { compileInk } from '@narratives/foundation/testing';
import { readFile } from 'node:fs/promises';
import { run } from '#src/main';

/**
 * The first message the thread rendered into `host`, once Lit has rendered it.
 * @param {ParentNode} host Where the thread rendered.
 * @returns {Promise<SkMessage>} The rendered message element.
 */
async function firstMessage(host: Readonly<Pick<ParentNode, 'querySelector'>>): Promise<SkMessage> {
  const element = host.querySelector('sk-message');
  if (!(element instanceof SkMessage)) {
    throw new TypeError('the thread rendered no sk-message element');
  }
  await element.updateComplete;
  return element;
}

describe('the walking skeleton', () => {
  test('ink → reduce → Lit render', async () => {
    expect.hasAssertions();
    // Read via a cwd-relative path (happy-dom makes import.meta.url non-file).
    const json = compileInk(await readFile('experiences/sandbox/story.ink', 'utf8'));
    const host = document.createElement('div');
    document.body.append(host);
    run(host, json);

    // AC #3: the component rendered.
    const element = await firstMessage(host);
    // The text flowed through.
    expect(element.shadowRoot?.textContent).toContain('walking skeleton');
    // AC #2: the speaker tag was parsed by reduce.
    expect(element.shadowRoot?.textContent).toContain('Skeleton:');
  });
});
