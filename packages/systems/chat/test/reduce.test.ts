import { describe, expect, test } from 'vitest';
import type { InkStep } from '@narratives/foundation';
import { parseTag } from '@narratives/foundation';
import { reduceStep } from '#src/reduce';

/**
 * An ink step with this text and these raw tags.
 *
 * @param {string} text - The step's text.
 * @param {readonly string[]} rawTags - Its tags as ink writes them, such as `speaker: Pat`.
 * @returns {InkStep} A continuing step with no choices and no external calls.
 */
function step(text: string, rawTags: readonly string[] = []): InkStep {
  return {
    choices: [],
    externalCalls: [],
    status: 'continue',
    tags: rawTags.map((raw) => parseTag(raw)),
    text,
  };
}

// The stub reduce maps an ink step to a message view-model.
describe('the step parser', () => {
  test('parses the speaker tag into the view-model', () => {
    expect.hasAssertions();
    expect(reduceStep(step('Hello', ['speaker: Pat']))).toStrictEqual({ speaker: 'Pat', text: 'Hello' });
  });

  test('leaves the speaker empty when there is no speaker tag', () => {
    expect.hasAssertions();
    expect(reduceStep(step('System line'))).toStrictEqual({ speaker: '', text: 'System line' });
  });
});
