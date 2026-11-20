import type { ChatState, ChatView, ReadCursor } from '#src/state';
import type { ChatMessageVM } from '#src/reduce';
import type { Item } from '@narratives/foundation';
import { readerOf } from '@narratives/foundation';

/*
 * The chat system's parse of a restored state: a save is read back untyped, and every field the
 * slice holds is read into its own type or the whole state is refused, naming the field.
 */

/** The chat system's readers. */
const READ = readerOf('chat');

/**
 * A field that may be absent: absent stays absent, anything else is read by `item`.
 *
 * @param {string} name - The field's name.
 * @param {unknown} value - The field's value.
 * @param {Item} item - The reader of a present value.
 * @returns {object} The field, to spread into its owner: nothing when absent.
 */
function optional<TName extends string, TValue>(name: TName, value: unknown, item: Item<TValue>): Partial<Record<TName, TValue>> {
  const read: Partial<Record<TName, TValue>> = {};
  if (value !== undefined) {
    read[name] = item(value, name);
  }
  return read;
}

/**
 * Read one message of a chat's history or deferred queue.
 *
 * @param {unknown} entry - The entry.
 * @param {string} at - Where the entry sits.
 * @returns {ChatMessageVM} The message.
 */
function messageOf(entry: unknown, at: string): ChatMessageVM {
  const message = READ.object(entry, at);
  return {
    chatId: READ.string(message['chatId'], `${at}.chatId`),
    id: READ.string(message['id'], `${at}.id`),
    speaker: READ.string(message['speaker'], `${at}.speaker`),
    text: READ.string(message['text'], `${at}.text`),
    ...optional('time', message['time'], READ.number),
  };
}

/**
 * Read a chat's list of messages.
 *
 * @param {unknown} entry - The list.
 * @param {string} at - Where it sits.
 * @returns {readonly ChatMessageVM[]} The messages.
 */
function messagesOf(entry: unknown, at: string): readonly ChatMessageVM[] {
  return READ.list(entry, at, messageOf);
}

/** How each kind of read cursor is read from its saved fields, keyed by the cursor's own words. */
const CURSORS: Readonly<Record<ReadCursor['at'], (cursor: Readonly<Record<string, unknown>>, at: string) => ReadCursor>> = {
  after: (cursor, at) => ({ at: 'after', messageId: READ.string(cursor['messageId'], `${at}.messageId`) }),
  top: () => ({ at: 'top' }),
};

/**
 * Whether a saved value names a kind of read cursor.
 *
 * @param {unknown} kind - The saved `at` field.
 * @returns {boolean} Whether it is one of the cursor's words.
 */
function isCursorKind(kind: unknown): kind is ReadCursor['at'] {
  return typeof kind === 'string' && Object.hasOwn(CURSORS, kind);
}

/**
 * Read a chat's read cursor: above every message, or after a named one.
 *
 * @param {unknown} entry - The cursor.
 * @param {string} at - Where it sits.
 * @returns {ReadCursor} The cursor.
 */
function cursorOf(entry: unknown, at: string): ReadCursor {
  const cursor = READ.object(entry, at);
  const kind = cursor['at'];
  return isCursorKind(kind) ? CURSORS[kind](cursor, at) : READ.refuse(at, entry);
}

/**
 * Read the view the player is on: the hub, or one chat.
 *
 * @param {unknown} entry - The view.
 * @returns {ChatView} The view.
 */
function viewOf(entry: unknown): ChatView {
  const view = READ.object(entry, 'currentView');
  switch (view['type']) {
    case 'hub':
    case 'chat': {
      return { type: view['type'], ...optional('chatId', view['chatId'], READ.string) };
    }
    default: {
      return READ.refuse('currentView', entry);
    }
  }
}

/**
 * Parse a restored chat slice.
 *
 * @param {unknown} value - The restored value.
 * @returns {ChatState} The slice; any other value is refused, naming the field.
 */
function parseChatState(value: unknown): ChatState {
  const state = READ.object(value, 'a state');
  return {
    currentView: viewOf(state['currentView']),
    deferredMessages: READ.record(state['deferredMessages'], 'deferredMessages', messagesOf),
    lastReadMessageId: READ.record(state['lastReadMessageId'], 'lastReadMessageId', cursorOf),
    messageHistory: READ.record(state['messageHistory'], 'messageHistory', messagesOf),
    notifiedChatIds: READ.list(state['notifiedChatIds'], 'notifiedChatIds', READ.string),
    ...optional('activeChat', state['activeChat'], READ.string),
    ...optional('clock', state['clock'], READ.number),
  };
}

export { parseChatState };
