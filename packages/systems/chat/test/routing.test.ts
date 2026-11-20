import { describe, expect, test } from 'vitest';
import { messagesOf, run, story, textsOf } from '#test/support';

describe('message routing', () => {
  test('a # chat: tag sets the default route for subsequent messages (#1)', async () => {
    expect.hasAssertions();
    const result = await run([story('', ['chat: pat']), story('Hey there', ['speaker: Pat'])]);
    expect(textsOf(result, 'pat')).toStrictEqual(['Hey there']);
  });

  test('# targetChat overrides the active chat (#1)', async () => {
    expect.hasAssertions();
    const result = await run([story('', ['chat: pat']), story('Over here', ['targetChat: side', 'speaker: Sam'])]);
    expect(textsOf(result, 'side')).toStrictEqual(['Over here']);
    expect(messagesOf(result, 'pat')).toStrictEqual([]);
  });

  test('a message with no context falls back to the default chat (#1)', async () => {
    expect.hasAssertions();
    const result = await run([story('Orphan', ['speaker: X'])]);
    expect(textsOf(result, 'main')).toStrictEqual(['Orphan']);
  });

  test('each message carries a stable id and its owning chatId (#3)', async () => {
    expect.hasAssertions();
    const result = await run([story('', ['chat: pat']), story('One', ['speaker: Pat']), story('Two', ['speaker: Pat'])]);
    const messages = messagesOf(result, 'pat');
    expect(messages.map((message) => message.chatId)).toStrictEqual(['pat', 'pat']);
    expect(new Set(messages.map((message) => message.id)).size).toBe(messages.length);
  });

  test('a chat id that names an Object.prototype member routes like any other', async () => {
    expect.hasAssertions();
    const result = await run([
      story('', ['chat: toString']),
      story('First', ['speaker: Pat']),
      story('Second', ['targetChat: constructor', 'speaker: Sam']),
      story('Third', ['speaker: Pat']),
    ]);
    expect(textsOf(result, 'toString')).toStrictEqual(['First', 'Third']);
    expect(textsOf(result, 'constructor')).toStrictEqual(['Second']);
  });
});
