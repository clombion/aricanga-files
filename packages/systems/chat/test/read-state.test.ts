import { close, cursorsOf, messagesOf, open, run, story } from '#test/support';
import { describe, expect, test } from 'vitest';
import type { ChatRun } from '#test/support';
import type { ReadCursor } from '#src/state';
import { hwmMonotonic } from '@narratives/system-chat/testing';

/**
 * The cursor after a chat's message with this text.
 *
 * @param {ChatRun} result - The completed run.
 * @param {string} chatId - The chat.
 * @param {string} text - The message's text.
 * @returns {ReadCursor} A cursor after that message.
 */
function afterMessage(result: ChatRun, chatId: string, text: string): ReadCursor {
  const message = messagesOf(result, chatId).find((candidate) => candidate.text === text);
  if (message === undefined) {
    throw new Error(`chat "${chatId}" holds no message "${text}"`);
  }
  return { at: 'after', messageId: message.id };
}

describe('the read cursor', () => {
  test('advances to the last message when you close a chat (#1)', async () => {
    expect.hasAssertions();
    const result = await run([open('pat'), story('A', ['targetChat: pat']), story('B', ['targetChat: pat']), close()]);
    expect(cursorsOf(result)['pat']).toStrictEqual(afterMessage(result, 'pat', 'B'));
  });

  test('advances for the previous chat on chat-to-chat navigation (#1)', async () => {
    expect.hasAssertions();
    const result = await run([open('pat'), story('A', ['targetChat: pat']), open('maria')]);
    expect(cursorsOf(result)['pat']).toStrictEqual(afterMessage(result, 'pat', 'A'));
  });

  test('is not written on initial open or on receiving while viewing (#1)', async () => {
    expect.hasAssertions();
    const result = await run([open('pat'), story('A', ['targetChat: pat'])]);
    expect(cursorsOf(result)).not.toHaveProperty('pat');
  });
});

describe('the unread anchor', () => {
  test('anchors an empty chat at the top on its first notification (#2, #3)', async () => {
    expect.hasAssertions();
    // From the hub, a background chat's message notifies it.
    const result = await run([story('Hi', ['targetChat: maria'])]);
    expect(cursorsOf(result)['maria']).toStrictEqual({ at: 'top' });
  });

  test('is kept across later notifications: the anchor is not clobbered (#2)', async () => {
    expect.hasAssertions();
    const result = await run([
      // Notifies, and anchors pat at the top.
      story('First', ['targetChat: pat']),
      // Clears the notified state.
      open('pat'),
      // Reads pat to First.
      close(),
      // Notifies again; the cursor stays after First.
      story('Second', ['targetChat: pat']),
    ]);
    expect(cursorsOf(result)['pat']).toStrictEqual(afterMessage(result, 'pat', 'First'));
  });

  test('hwmMonotonic holds over a notify, open and leave stream (#5)', async () => {
    expect.hasAssertions();
    const result = await run([
      // Anchors maria at the top.
      story('A', ['targetChat: maria']),
      // Clears the notified state.
      open('maria'),
      // Viewed: straight to history.
      story('B', ['targetChat: maria']),
      // Reads maria to B.
      close(),
    ]);
    // The top anchor advanced to a real message.
    expect(cursorsOf(result)['maria']).toStrictEqual(afterMessage(result, 'maria', 'B'));
    expect(hwmMonotonic(result)).toBeUndefined();
  });
});
