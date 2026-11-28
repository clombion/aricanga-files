import { describe, test } from 'vitest';
import { InkRuntime } from '#src/ink/ink-runtime';
import type { InkStory } from '#src/ink/ink-runtime';

/** The index of the one choice the double offers. */
const FIRST = 0;

/**
 * A double's handler for a call it was not scripted for.
 *
 * @param {string} what - The call, for the failure.
 * @returns {Function} A handler that fails the test.
 */
function refuse(what: string): () => never {
  return () => {
    throw new Error(`no ${what} expected`);
  };
}

/**
 * The absent value of inkjs. It declares a line, the current tags and a choice's tags as possibly
 * absent; the double hands back exactly that value, read from the platform rather than written.
 *
 * @returns {null} The absent value.
 */
function absent(): null {
  const value: unknown = Object.getPrototypeOf(Object.prototype);
  if (value === null) {
    return value;
  }
  throw new Error('Object.prototype has a prototype');
}

/**
 * A story double at a choice point whose line, tags and choice tags are all absent. It accepts the
 * externals the runtime binds when built and refuses every other call.
 *
 * @returns {InkStory} The double.
 */
function absentStory(): InkStory {
  return {
    BindExternalFunction: () => {
      // The runtime binds its externals when built; this story never calls one back.
    },
    ChooseChoiceIndex: refuse('choice'),
    Continue: () => absent(),
    canContinue: false,
    currentChoices: [{ index: FIRST, tags: absent(), text: 'Go on' }],
    currentTags: absent(),
    state: { LoadJson: refuse('load'), ToJson: refuse('save') },
  };
}

describe('the ink runtime over the story surface inkjs declares', () => {
  test('reads an absent line, absent tags and an absent choice tag list as empty', ({ expect }) => {
    expect.hasAssertions();
    expect(new InkRuntime(absentStory()).continue()).toStrictEqual({
      choices: [{ index: FIRST, tags: [], text: 'Go on' }],
      externalCalls: [],
      status: 'await-choice',
      tags: [],
      text: '',
    });
  });

  test('the double refuses a call it was not scripted for', ({ expect }) => {
    expect.hasAssertions();
    expect(() => {
      new InkRuntime(absentStory()).choose(FIRST);
    }).toThrow('no choice expected');
  });
});
