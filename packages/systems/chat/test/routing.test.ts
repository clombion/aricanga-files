import { expect, test } from 'vitest';
import { messagesOf, run, story } from './support';

test('a # chat: tag sets the default route for subsequent messages (#1)', async () => {
  const r = await run([story('', ['chat: pat']), story('Hey there', ['speaker: Pat'])]);
  expect(messagesOf(r, 'pat').map((m) => m.text)).toEqual(['Hey there']);
});

test('# targetChat overrides the active chat (#1)', async () => {
  const r = await run([story('', ['chat: pat']), story('Over here', ['targetChat: side', 'speaker: Sam'])]);
  expect(messagesOf(r, 'side').map((m) => m.text)).toEqual(['Over here']);
  expect(messagesOf(r, 'pat')).toEqual([]);
});

test('a message with no context falls back to the default chat (#1)', async () => {
  const r = await run([story('Orphan', ['speaker: X'])]);
  expect(messagesOf(r, 'main').map((m) => m.text)).toEqual(['Orphan']);
});

test('each message carries a stable id and its owning chatId (#3)', async () => {
  const r = await run([story('', ['chat: pat']), story('One', ['speaker: Pat']), story('Two', ['speaker: Pat'])]);
  const msgs = messagesOf(r, 'pat');
  expect(msgs.map((m) => m.chatId)).toEqual(['pat', 'pat']);
  expect(new Set(msgs.map((m) => m.id)).size).toBe(2);
});
