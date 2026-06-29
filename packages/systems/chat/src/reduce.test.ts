import { type InkStep, parseTag } from '@narratives/foundation';
import { expect, test } from 'vitest';
import { reduceStep } from './reduce';

const step = (text: string, rawTags: string[] = []): InkStep => ({
  text,
  tags: rawTags.map(parseTag),
  choices: [],
  externalCalls: [],
  status: 'continue',
});

// Stub reduce maps an ink step to a message view-model (task-007 AC #2).
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
