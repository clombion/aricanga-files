import { expect, test } from 'vitest';
import { reduceChunk } from './reduce';

// Stub reduce maps a chunk to a message view-model (task-007 AC #2).
test('reduceChunk parses the speaker tag into the view-model', () => {
  expect(reduceChunk({ text: 'Hello', tags: ['speaker: Pat'] })).toEqual({
    speaker: 'Pat',
    text: 'Hello',
  });
});

test('reduceChunk leaves speaker empty when there is no speaker tag', () => {
  expect(reduceChunk({ text: 'System line', tags: [] })).toEqual({
    speaker: '',
    text: 'System line',
  });
});
