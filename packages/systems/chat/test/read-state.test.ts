import { erase, parseTag } from '@narratives/foundation';
import { type FixtureInput, type FixtureRun, runStream } from '@narratives/foundation/testing';
import { hwmMonotonic } from '@narratives/system-chat/testing';
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
const close = (): FixtureInput => ({
  input: { source: 'player', command: { kind: 'close', payload: undefined } },
  target: 'chat',
});

const run = (inputs: FixtureInput[]): Promise<FixtureRun> =>
  runStream({ systems: [erase(chatSystem)], foreground: 'chat' }, inputs);

const vm = (r: FixtureRun): { messages: Record<string, readonly ChatMessageVM[]>; lastRead: Record<string, string | null> } =>
  r.view('chat') as never;
const cursor = (r: FixtureRun): Record<string, string | null> => vm(r).lastRead;
const history = (r: FixtureRun, chatId: string): readonly ChatMessageVM[] => vm(r).messages[chatId] ?? [];

test('the read cursor advances to the last message when you close a chat (#1)', async () => {
  const r = await run([open('pat'), story('A', ['targetChat: pat']), story('B', ['targetChat: pat']), close()]);
  expect(cursor(r).pat).toBe(history(r, 'pat').at(-1)?.id);
});

test('chat-to-chat navigation advances the previous chat cursor (#1)', async () => {
  const r = await run([open('pat'), story('A', ['targetChat: pat']), open('maria')]);
  expect(cursor(r).pat).toBe(history(r, 'pat').at(-1)?.id);
});

test('the cursor is not written on initial open or on receiving while viewing (#1)', async () => {
  const r = await run([open('pat'), story('A', ['targetChat: pat'])]);
  expect('pat' in cursor(r)).toBe(false);
});

test('the first notification anchors an empty chat at before-all (null) (#2, #3)', async () => {
  const r = await run([story('Hi', ['targetChat: maria'])]); // hub → background → notify
  expect('maria' in cursor(r)).toBe(true);
  expect(cursor(r).maria).toBeNull();
});

test('a set cursor is preserved across later notifications (anchor not clobbered) (#2)', async () => {
  const r = await run([
    story('First', ['targetChat: pat']), // notify, anchor null
    open('pat'), // clears notified
    close(), // cursor[pat] = First.id
    story('Second', ['targetChat: pat']), // notify again — anchor preserved at First
  ]);
  expect(cursor(r).pat).toBe(history(r, 'pat')[0]?.id);
});

test('hwmMonotonic holds over a notify → open → leave stream (#5)', async () => {
  const r = await run([
    story('A', ['targetChat: maria']), // anchor null (before-all)
    open('maria'), // clear notified
    story('B', ['targetChat: maria']), // viewed → history
    close(), // cursor[maria] → B.id
  ]);
  expect(cursor(r).maria).toBe(history(r, 'maria').at(-1)?.id); // null advanced to a real id
  expect(hwmMonotonic(r)).toBeNull();
});
