import { describe, expect, test } from 'vitest';
import { messagesOf, open, run, story, textsOf } from '#test/support';
import type { ChatRun } from '#test/support';
import type { Effect } from '@narratives/foundation';
import { notificationOf } from '#src/effects';
import { notifyOnce } from '@narratives/system-chat/testing';

/** A chat notified once in an epoch. */
const ONCE = 1;

/**
 * The notifications a run emitted for a chat.
 *
 * @param {ChatRun} result - The completed run.
 * @param {string} chatId - The chat.
 * @returns {readonly Effect[]} Its notification effects, in order.
 */
function notifications(result: ChatRun, chatId: string): readonly Effect[] {
  return result.effects.filter((effect) => notificationOf(effect)?.chatId === chatId);
}

describe('notifications', () => {
  test('notify-once: a background chat notifies once, not for subsequent messages (#2)', async () => {
    expect.hasAssertions();
    const result = await run([story('First', ['targetChat: maria']), story('Second', ['targetChat: maria'])]);
    expect(notifications(result, 'maria')).toHaveLength(ONCE);
    expect(notifyOnce(result)).toBeUndefined();
  });

  test('no notification fires for the currently-viewed chat (#3)', async () => {
    expect.hasAssertions();
    const result = await run([open('pat'), story('You are here', ['targetChat: pat'])]);
    expect(notifications(result, 'pat')).toStrictEqual([]);
    expect(textsOf(result, 'pat')).toStrictEqual(['You are here']);
  });
});

describe('the deferred queue', () => {
  test('a message for a different OPEN chat defers after the first notification (#1)', async () => {
    expect.hasAssertions();
    const result = await run([
      open('pat'),
      // The first goes to history and notifies.
      story('Hi from Maria', ['targetChat: maria']),
      // Already notified, and pat is open: deferred.
      story('And another', ['targetChat: maria']),
    ]);
    expect(textsOf(result, 'maria')).toStrictEqual(['Hi from Maria']);
    expect(notifications(result, 'maria')).toHaveLength(ONCE);
  });

  test('opening a chat replays its deferred queue into history in order (#4)', async () => {
    expect.hasAssertions();
    const texts = ['One', 'Two', 'Three'];
    const result = await run([open('pat'), ...texts.map((text) => story(text, ['targetChat: maria'])), open('maria')]);
    expect(textsOf(result, 'maria')).toStrictEqual(texts);
    // The ids are kept and distinct: the queued messages are moved, not rebuilt.
    expect(new Set(messagesOf(result, 'maria').map((message) => message.id)).size).toBe(texts.length);
  });

  test('# immediate bypasses the queue and flushes existing deferred into history (#5)', async () => {
    expect.hasAssertions();
    const result = await run([
      open('pat'),
      // Notifies, and goes to history.
      story('Queued 1', ['targetChat: maria']),
      // Deferred.
      story('Queued 2', ['targetChat: maria']),
      // Flushes the queue and appends, never deferred.
      story('Urgent', ['targetChat: maria', 'immediate']),
    ]);
    expect(textsOf(result, 'maria')).toStrictEqual(['Queued 1', 'Queued 2', 'Urgent']);
    expect(notifyOnce(result)).toBeUndefined();
  });
});
