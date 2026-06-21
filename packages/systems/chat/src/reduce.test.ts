import { parseTag } from '@narratives/foundation';
import { expect, test } from 'vitest';
import { reduceChunk } from './reduce';

const chunk = (text: string, rawTags: string[] = []) => ({
  text,
  tags: rawTags.map(parseTag),
  choices: [],
  isChoicePoint: false,
});

// Stub reduce maps a chunk to a message view-model (task-007 AC #2).
test('reduceChunk parses the speaker tag into the view-model', () => {
  expect(reduceChunk(chunk('Hello', ['speaker: Pat']))).toEqual({
    speaker: 'Pat',
    text: 'Hello',
  });
});

test('reduceChunk leaves speaker empty when there is no speaker tag', () => {
  expect(reduceChunk(chunk('System line'))).toEqual({
    speaker: '',
    text: 'System line',
  });
});
