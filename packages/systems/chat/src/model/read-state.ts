import type { ChatState } from '../state';
import { closeChat, openChat } from './defer';

// Advance the read cursor for a chat you're leaving to its last message. A no-op
// on an empty chat — never write `null` on leave (under this encoding `null` means
// before-all/top, and the cursor must never un-read).
export function markRead(state: ChatState, chatId: string): ChatState {
  const last = (state.messageHistory[chatId] ?? []).at(-1);
  if (last === undefined) return state;
  return { ...state, lastReadMessageId: { ...state.lastReadMessageId, [chatId]: last.id } };
}

const focusedChat = (state: ChatState): string | undefined =>
  state.currentView.type === 'chat' ? state.currentView.chatId : undefined;

// Open a chat: on chat-to-chat navigation, mark the chat you're leaving read first
// (the cursor is not written for the chat being opened), then focus + clear-notified
// + replay (task-021's `openChat`).
export function openWithReadState(state: ChatState, chatId: string): ChatState {
  const prev = focusedChat(state);
  const left = prev !== undefined && prev !== chatId ? markRead(state, prev) : state;
  return openChat(left, chatId);
}

// Close: mark the current chat read, then return to the hub.
export function closeWithReadState(state: ChatState): ChatState {
  const prev = focusedChat(state);
  return closeChat(prev !== undefined ? markRead(state, prev) : state);
}
