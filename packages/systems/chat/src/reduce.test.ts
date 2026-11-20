import { parseTag } from '@narratives/foundation';
import type { InkStep } from '@narratives/foundation';
import { expect, test } from 'vitest';
import { reduceStep } from './reduce';

const step = (text: string, rawTags: string[] = []): InkStep => ({
  choices: [],
  externalCalls: [],
  status: 'continue',
  tags: rawTags.map(parseTag),
  text,
});

// Stub reduce maps an ink step to a message view-model.
test('reduceStep parses the speaker tag into the view-model', () => {
  expect(reduceStep(step('Hello', ['speaker: Pat']))).toEqual({
    speaker: 'Pat',
    text: 'Hello',
  });
});

test('reduceStep leaves speaker empty when there is no speaker tag', () => {
  expect(reduceStep(step('System line'))).toEqual({
    speaker: '',
    text: 'System line',
  });
});
