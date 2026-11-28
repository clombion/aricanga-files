import { chatSystem, openedChat } from '#src/system';
import { close, open, run, story } from '#test/support';
import { describe, test } from 'vitest';
import type { ChatCommand } from '#src/system';
import type { FixtureCommand } from '@narratives/foundation/testing';
import { throughSave } from '@narratives/foundation/testing';

/** The seed a chat slice starts from. */
const SEED = 0;

/** Opening Pat's chat, as a player would send it. */
const OPEN_PAT: ChatCommand = { kind: 'open', payload: { chatId: 'pat' } };

/** Closing the open chat, as a player would send it. */
const CLOSE: ChatCommand = { kind: 'close', payload: undefined };

/** A command of another system's vocabulary, which chat does not take. */
const FOREIGN: FixtureCommand = { kind: 'choose', payload: { index: SEED } };

/** One of every chat command, each as a player would send it. */
const EVERY_COMMAND: readonly ChatCommand[] = [OPEN_PAT, CLOSE];

/**
 * The field names of a value read back untyped, in sorted order.
 *
 * @param {unknown} value - The value.
 * @returns {readonly string[]} Its own field names; none for a value that is no object.
 */
function fieldsOf(value: unknown): readonly string[] {
  return typeof value === 'object' && value !== null ? Object.keys(value).toSorted() : [];
}

/**
 * The chat slice after a story that sets every field of it: a conversation, an anchored clock,
 * messages in two chats, a chat opened and closed so it holds a read cursor, and a notification.
 *
 * @returns {Promise<unknown>} The chat slice the run's snapshot holds.
 */
async function playedState(): Promise<unknown> {
  const result = await run([
    story('Morning.', ['chat: pat', 'time: 08:35']),
    story('Are you up?', ['chat: pat']),
    open('pat'),
    close(),
    story('Hello from Maria.', ['chat: maria', 'speaker: Maria']),
  ]);
  return result.snapshot.state['chat'];
}

describe('the chat command parser', () => {
  test('reads every command back from saved text as the command it is', ({ expect }) => {
    expect.hasAssertions();
    expect(EVERY_COMMAND.map((command) => chatSystem.parseCommand(throughSave(command)))).toStrictEqual(EVERY_COMMAND);
  });

  test('refuses a command chat does not take, an open with no chat id, and a close that carries a payload', ({ expect }) => {
    expect.hasAssertions();
    expect(() => chatSystem.parseCommand(FOREIGN)).toThrow('system "chat" refuses a command: {"kind":"choose","payload":{"index":0}}');
    expect(() => chatSystem.parseCommand({ ...OPEN_PAT, payload: {} })).toThrow('system "chat" refuses chatId: undefined');
    expect(() => chatSystem.parseCommand({ ...OPEN_PAT, payload: { chatId: 7 } })).toThrow('system "chat" refuses chatId: 7');
    expect(() => chatSystem.parseCommand({ ...CLOSE, payload: 'pat' })).toThrow('system "chat" refuses the close payload: "pat"');
  });

  test('a recorded command that is not chat’s is refused, not read as opening nothing', ({ expect }) => {
    expect.hasAssertions();
    expect(openedChat(OPEN_PAT)).toBe('pat');
    expect(openedChat(CLOSE)).toBeUndefined();
    expect(() => openedChat({ kind: 'detonate', payload: undefined })).toThrow('system "chat" refuses a command');
  });
});

describe('the chat state parser', () => {
  test('reads a played slice back from saved text as the slice it is, every field included', async ({ expect }) => {
    expect.hasAssertions();
    const state = await playedState();
    expect(fieldsOf(state)).toStrictEqual([
      'activeChat',
      'clock',
      'currentView',
      'deferredMessages',
      'lastReadMessageId',
      'messageHistory',
      'notifiedChatIds',
    ]);
    expect(chatSystem.parseState(throughSave(state))).toStrictEqual(state);
  });

  test('refuses a slice with a field of the wrong shape, naming the field', ({ expect }) => {
    expect.hasAssertions();
    const fresh = chatSystem.init(SEED);
    expect(() => chatSystem.parseState({ ...fresh, currentView: { type: 'lobby' } })).toThrow(
      'system "chat" refuses currentView: {"type":"lobby"}',
    );
    expect(() => chatSystem.parseState({ ...fresh, lastReadMessageId: { pat: { at: 'middle' } } })).toThrow(
      'system "chat" refuses lastReadMessageId.pat: {"at":"middle"}',
    );
    expect(() =>
      chatSystem.parseState({ ...fresh, messageHistory: { pat: [{ chatId: 'pat', id: 'id-0', speaker: '', text: 1 }] } }),
    ).toThrow('system "chat" refuses messageHistory.pat[0].text: 1');
    expect(() => chatSystem.parseState({ ...fresh, clock: '08:35' })).toThrow('system "chat" refuses clock: "08:35"');
  });
});
