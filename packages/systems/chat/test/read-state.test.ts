import type { FixtureRun } from '@narratives/foundation/testing';
import { hwmMonotonic } from '@narratives/system-chat/testing';
import { expect, test } from 'vitest';
import { type ChatViewModel, chatSystem } from '../src/system';
import { close, messagesOf as history, open, run, story } from './support';

const cursor = (r: FixtureRun): ChatViewModel['lastRead'] => r.viewOf(chatSystem).lastRead;

test('the read cursor advances to the last message when you close a chat (#1)', async () => {
  const r = await run([open('pat'), story('A', ['targetChat: pat']), story('B', ['targetChat: pat']), close()]);
  expect(cursor(r)['pat']).toBe(history(r, 'pat').at(-1)?.id);
});

test('chat-to-chat navigation advances the previous chat cursor (#1)', async () => {
  const r = await run([open('pat'), story('A', ['targetChat: pat']), open('maria')]);
  expect(cursor(r)['pat']).toBe(history(r, 'pat').at(-1)?.id);
});

test('the cursor is not written on initial open or on receiving while viewing (#1)', async () => {
  const r = await run([open('pat'), story('A', ['targetChat: pat'])]);
  expect('pat' in cursor(r)).toBe(false);
});

test('the first notification anchors an empty chat at before-all (null) (#2, #3)', async () => {
  const r = await run([story('Hi', ['targetChat: maria'])]); // hub → background → notify
  expect('maria' in cursor(r)).toBe(true);
  expect(cursor(r)['maria']).toBeNull();
});

test('a set cursor is preserved across later notifications (anchor not clobbered) (#2)', async () => {
  const r = await run([
    story('First', ['targetChat: pat']), // notify, anchor null
    open('pat'), // clears notified
    close(), // cursor[pat] = First.id
    story('Second', ['targetChat: pat']), // notify again — anchor preserved at First
  ]);
  expect(cursor(r)['pat']).toBe(history(r, 'pat')[0]?.id);
});

test('hwmMonotonic holds over a notify → open → leave stream (#5)', async () => {
  const r = await run([
    story('A', ['targetChat: maria']), // anchor null (before-all)
    open('maria'), // clear notified
    story('B', ['targetChat: maria']), // viewed → history
    close(), // cursor[maria] → B.id
  ]);
  expect(cursor(r)['maria']).toBe(history(r, 'maria').at(-1)?.id); // null advanced to a real id
  expect(hwmMonotonic(r)).toBeNull();
});
