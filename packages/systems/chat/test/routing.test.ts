import { erase, parseTag } from '@narratives/foundation';
import { type FixtureInput, type FixtureRun, runStream } from '@narratives/foundation/testing';
import { expect, test } from 'vitest';
import { chatSystem } from '../src/system';
import type { ChatMessageVM } from '../src/reduce';

const story = (text: string, rawTags: string[] = []): FixtureInput => ({
  input: {
    source: 'story',
    step: { text, tags: rawTags.map(parseTag), choices: [], externalCalls: [], status: 'continue' },
  },
});

const run = (inputs: FixtureInput[]): Promise<FixtureRun> =>
  runStream({ systems: [erase(chatSystem)], foreground: 'chat' }, inputs);

const messagesOf = (r: FixtureRun, chatId: string): readonly ChatMessageVM[] => {
  const vm = r.view('chat') as { messages: Readonly<Record<string, readonly ChatMessageVM[]>> };
  return vm.messages[chatId] ?? [];
};

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
