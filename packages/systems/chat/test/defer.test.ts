import { erase, parseTag } from '@narratives/foundation';
import { type FixtureInput, type FixtureRun, runStream } from '@narratives/foundation/testing';
import { notifyOnce } from '@narratives/system-chat/testing';
import { expect, test } from 'vitest';
import type { ChatMessageVM } from '../src/reduce';
import { chatSystem } from '../src/system';

const story = (text: string, rawTags: string[] = []): FixtureInput => ({
  input: {
    source: 'story',
    step: { text, tags: rawTags.map(parseTag), choices: [], externalCalls: [], status: 'continue' },
  },
});
const open = (chatId: string): FixtureInput => ({
  input: { source: 'player', command: { kind: 'open', payload: { chatId } } },
  target: 'chat',
});

const run = (inputs: FixtureInput[]): Promise<FixtureRun> =>
  runStream({ systems: [erase(chatSystem)], foreground: 'chat' }, inputs);

const history = (r: FixtureRun, chatId: string): readonly ChatMessageVM[] =>
  (r.view('chat') as { messages: Readonly<Record<string, readonly ChatMessageVM[]>> }).messages[chatId] ?? [];
const notifications = (r: FixtureRun, chatId: string): number =>
  r.effects.filter((e) => e.kind === 'chat/showNotification' && (e.payload as { chatId: string }).chatId === chatId).length;

test('notify-once: a background chat notifies once, not for subsequent messages (#2)', async () => {
  const r = await run([story('First', ['targetChat: maria']), story('Second', ['targetChat: maria'])]);
  expect(notifications(r, 'maria')).toBe(1);
  expect(notifyOnce(r)).toBeNull();
});

test('a message for a different OPEN chat defers after the first notification (#1)', async () => {
  const r = await run([
    open('pat'),
    story('Hi from Maria', ['targetChat: maria']), // first → history + notify
    story('And another', ['targetChat: maria']), // already-notified, in pat → defer
  ]);
  expect(history(r, 'maria').map((m) => m.text)).toEqual(['Hi from Maria']);
  expect(notifications(r, 'maria')).toBe(1);
});

test('opening a chat replays its deferred queue into history in order (#4)', async () => {
  const r = await run([
    open('pat'),
    story('One', ['targetChat: maria']),
    story('Two', ['targetChat: maria']),
    story('Three', ['targetChat: maria']),
    open('maria'),
  ]);
  expect(history(r, 'maria').map((m) => m.text)).toEqual(['One', 'Two', 'Three']);
  const ids = history(r, 'maria').map((m) => m.id);
  expect(new Set(ids).size).toBe(3); // ids preserved + distinct (moved, not rebuilt)
});

test('no notification fires for the currently-viewed chat (#3)', async () => {
  const r = await run([open('pat'), story('You are here', ['targetChat: pat'])]);
  expect(notifications(r, 'pat')).toBe(0);
  expect(history(r, 'pat').map((m) => m.text)).toEqual(['You are here']);
});

test('# immediate bypasses the queue and flushes existing deferred into history (#5)', async () => {
  const r = await run([
    open('pat'),
    story('Queued 1', ['targetChat: maria']), // notify + history
    story('Queued 2', ['targetChat: maria']), // defer
    story('Urgent', ['targetChat: maria', 'immediate']), // flush + append, no defer
  ]);
  expect(history(r, 'maria').map((m) => m.text)).toEqual(['Queued 1', 'Queued 2', 'Urgent']);
  expect(notifyOnce(r)).toBeNull();
});
