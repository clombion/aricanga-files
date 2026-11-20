import { closeChat, openChat, viewedChatId } from '#src/model/defer';
import type { ChatState } from '#src/state';

/** The index `Array.prototype.at` reads the last element at. */
const LAST = -1;

/**
 * Advance the read cursor of a chat the player is leaving to its last message. A no-op on an empty
 * chat: leaving never moves a cursor to the top, since the cursor must never un-read.
 *
 * @param {ChatState} state - The chat slice.
 * @param {string} chatId - The chat being left.
 * @returns {ChatState} The slice with the chat read to its end.
 */
function markRead(state: ChatState, chatId: string): ChatState {
  const last = state.messageHistory[chatId]?.at(LAST);
  if (last === undefined) {
    return state;
  }
  return { ...state, lastReadMessageId: { ...state.lastReadMessageId, [chatId]: { at: 'after', messageId: last.id } } };
}

/**
 * Open a chat: on chat-to-chat navigation, mark the chat being left read first (the cursor of the
 * chat being opened is not written), then focus, clear-notified and replay (the defer branch's
 * `openChat`).
 *
 * @param {ChatState} state - The chat slice.
 * @param {string} chatId - The chat to open.
 * @returns {ChatState} The slice viewing the chat.
 */
function openWithReadState(state: ChatState, chatId: string): ChatState {
  const prev = viewedChatId(state);
  const left = prev !== undefined && prev !== chatId ? markRead(state, prev) : state;
  return openChat(left, chatId);
}

/**
 * Close: mark the open chat read, then return to the hub.
 *
 * @param {ChatState} state - The chat slice.
 * @returns {ChatState} The slice viewing the hub.
 */
function closeWithReadState(state: ChatState): ChatState {
  const prev = viewedChatId(state);
  return closeChat(prev === undefined ? state : markRead(state, prev));
}

export { closeWithReadState, openWithReadState };
