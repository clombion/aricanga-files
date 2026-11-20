import { chatSystem, openedChat } from '#src/system';
import { close, open, run, story } from '#test/support';
import { describe, expect, test } from 'vitest';
import type { ChatCommand } from '#src/system';

/** The seed a chat slice starts from. */
const SEED = 0;

/** One of every chat command, each as a player would send it. */
const EVERY_COMMAND: readonly ChatCommand[] = [
  { kind: 'open', payload: { chatId: 'pat' } },
  { kind: 'close', payload: undefined },
];

/**
 * A value as it comes back from saved text: the JSON round trip a save and a load make.
 *
 * @param {unknown} value - The value saved.
 * @returns {unknown} The value read back, untyped.
 */
function throughText(value: unknown): unknown {
  const text = JSON.stringify(value);
  const read: unknown = JSON.parse(text);
  return read;
}

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
  test('reads every command back from saved text as the command it is', () => {
    expect.hasAssertions();
    expect(EVERY_COMMAND.map((command) => chatSystem.parseCommand(throughText(command)))).toStrictEqual(EVERY_COMMAND);
  });

  test('refuses a command chat does not take, an open with no chat id, and a close that carries a payload', () => {
    expect.hasAssertions();
    expect(() => chatSystem.parseCommand({ kind: 'choose', payload: { index: SEED } })).toThrow(
      'system "chat" refuses a command: {"kind":"choose","payload":{"index":0}}',
    );
    expect(() => chatSystem.parseCommand({ kind: 'open', payload: {} })).toThrow('system "chat" refuses chatId: undefined');
    expect(() => chatSystem.parseCommand({ kind: 'open', payload: { chatId: 7 } })).toThrow('system "chat" refuses chatId: 7');
    expect(() => chatSystem.parseCommand({ kind: 'close', payload: 'pat' })).toThrow('system "chat" refuses the close payload: "pat"');
  });

  test('a recorded command that is not chat’s is refused, not read as opening nothing', () => {
    expect.hasAssertions();
    expect(openedChat({ kind: 'open', payload: { chatId: 'pat' } })).toBe('pat');
    expect(openedChat({ kind: 'close', payload: undefined })).toBeUndefined();
    expect(() => openedChat({ kind: 'detonate', payload: undefined })).toThrow('system "chat" refuses a command');
  });
});

describe('the chat state parser', () => {
  test('reads a played slice back from saved text as the slice it is, every field included', async () => {
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
    expect(chatSystem.parseState(throughText(state))).toStrictEqual(state);
  });

  test('refuses a slice with a field of the wrong shape, naming the field', () => {
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
