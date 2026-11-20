import { describe, expect, test } from 'vitest';
import type { ChatCommand } from '#src/system';
import type { ChatState } from '#src/state';
import type { Input } from '@narratives/foundation';
import { chatSystem } from '#src/system';
import { initChatState } from '#src/state';
import { parseTag } from '@narratives/foundation';
import { throughSave } from '@narratives/foundation/testing';

/** The id the first message is minted with. */
const FIRST_ID = 'id-0';

/** The id a reduction mints for the next message. */
const NEXT_ID = 'id-9';

/**
 * A story line for a chat.
 *
 * @param {string} text - The line.
 * @param {string} chatId - The chat it targets.
 * @returns {Input} The story input.
 */
function lineFor(text: string, chatId: string): Input<ChatState, ChatCommand> {
  return {
    source: 'story',
    step: { choices: [], externalCalls: [], status: 'continue', tags: [parseTag(`targetChat: ${chatId}`)], text },
  };
}

describe('a chat restored from a save', () => {
  test('anchors a notified chat with history and no cursor after its last message', () => {
    expect.hasAssertions();
    const empty = initChatState();
    const seen = chatSystem.reduce(empty, lineFor('Earlier', 'pat'), { nextId: () => FIRST_ID }).state;
    const saved = chatSystem.parseState(throughSave({ ...seen, lastReadMessageId: {}, notifiedChatIds: [] }));
    const notified = chatSystem.reduce(saved, lineFor('Later', 'pat'), { nextId: () => NEXT_ID }).state;
    expect(notified.lastReadMessageId['pat']).toStrictEqual({ at: 'after', messageId: FIRST_ID });
  });
});

describe('the chat system', () => {
  test('leaves its state as it is for a resume or a lifecycle input', () => {
    expect.hasAssertions();
    const state = initChatState();
    const ctx = { nextId: (): string => NEXT_ID };
    expect(chatSystem.reduce(state, { resume: { kind: 'story-loaded' }, source: 'resume' }, ctx)).toStrictEqual({ effects: [], state });
    expect(chatSystem.reduce(state, { lifecycle: { kind: 'reset' }, source: 'lifecycle' }, ctx)).toStrictEqual({ effects: [], state });
  });
});
