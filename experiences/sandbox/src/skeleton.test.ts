import { readFileSync } from 'node:fs';
import { Compiler } from 'inkjs/full';
import { expect, test } from 'vitest';
import { run } from './main';

// End-to-end smoke for the walking skeleton (task-007 AC #2, #3): ink compiles,
// flows through the stub reduce, and renders as a Lit component in the DOM.
test('walking skeleton: ink → reduce → Lit render', async () => {
  // Read via a cwd-relative path (happy-dom makes import.meta.url non-file).
  const src = readFileSync('experiences/sandbox/story.ink', 'utf8');
  const json = new Compiler(src).Compile().ToJson() ?? '';

  const host = document.createElement('div');
  document.body.appendChild(host);
  await run(host, json);

  const el = host.querySelector('sk-message');
  expect(el).toBeTruthy(); // AC #3 component rendered
  await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
  expect(el?.shadowRoot?.textContent).toContain('walking skeleton'); // text flowed through
  expect(el?.shadowRoot?.textContent).toContain('Skeleton:'); // AC #2 speaker tag parsed by reduce
});
