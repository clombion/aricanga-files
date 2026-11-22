/** A Markdown doc with no text has no lines, and so no block, fence or heading. */

import { describe, expect, test } from 'vitest';
import { Doc } from '#lib/docs.ts';

describe('an empty doc', () => {
  test('has no lines, blocks, fences or headings', () => {
    expect.hasAssertions();
    const doc = new Doc('plant/empty.md', '');
    expect([doc.lines, doc.blocks(), doc.fences(), doc.headings()]).toStrictEqual([[], [], [], []]);
  });
});
