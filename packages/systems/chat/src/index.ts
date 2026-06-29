// @narratives/system-chat — the chat vocabulary (messages, typing, receipts,
// notifications). Phase 1: a stub System implementation + the reduceStep helper
// (still used by the sandbox). Physics kernel lands in Phase 2.

export const CHAT_SYSTEM_ID = 'chat';

export { chatSystem, CHAT_TAGS } from './system';
export type { ChatViewModel } from './system';
export { initChatState } from './state';
export type { ChatState, ChatView } from './state';
export { reduceStep } from './reduce';
export type { ChatMessageVM } from './reduce';
