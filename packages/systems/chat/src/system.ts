import {
  type Command,
  type Effect,
  type ReduceResult,
  type System,
} from '@narratives/foundation';
import { isImmediate, placeMessage } from './model/defer';
import { closeWithReadState, openWithReadState } from './model/read-state';
import { buildMessage, readChatSwitch, resolveChatId } from './model/route';
import { type ChatState, initChatState } from './state';

// The chat player commands: open a chat (focus + clear-notified + replay) or
// close back to the hub.
export type ChatCommand =
  | Command<'open', { readonly chatId: string }>
  | Command<'close', undefined>;

export const CHAT_TAGS = [
  'chat',
  'speaker',
  'type',
  'time',
  'duration',
  'targetChat',
  'receipt',
  'immediate',
] as const;

export interface ChatViewModel {
  readonly view: ChatState['currentView'];
  readonly messages: ChatState['messageHistory'];
  // The read cursor per chat — the unread-separator anchor (absent = none,
  // null = before-all/top, id = after that id). Placement is derived in Phase 3.
  readonly lastRead: ChatState['lastReadMessageId'];
}

// Chat kernel (Phase 2). task-020: routing (`# chat:` context, `# targetChat`
// override, owning-chat identity). task-021: emergent notifications (notify-once),
// the deferred queue, `# immediate`, and the open/close lifecycle.
export const chatSystem: System<ChatState, ChatCommand, Effect, ChatViewModel> = {
  id: 'chat',
  tags: [...CHAT_TAGS],
  init: (_seed) => initChatState(),
  reduce(state, input, ctx): ReduceResult<ChatState, Effect> {
    if (input.source === 'player') {
      const { command } = input;
      if (command.kind === 'open') return { state: openWithReadState(state, command.payload.chatId), effects: [] };
      if (command.kind === 'close') return { state: closeWithReadState(state), effects: [] };
      return { state, effects: [] };
    }
    if (input.source !== 'story') return { state, effects: [] };
    const { step } = input;

    // A `# chat:` tag switches the conversation context for subsequent messages.
    const switched = readChatSwitch(step);
    const base = switched !== null ? { ...state, activeChat: switched } : state;
    if (step.text === '') return { state: base, effects: [] };

    const chatId = resolveChatId(step, base.activeChat);
    const message = buildMessage(step, chatId, ctx);
    return placeMessage(base, message, isImmediate(step));
  },
  status: () => 'free',
  view: (state) => ({
    view: state.currentView,
    messages: state.messageHistory,
    lastRead: state.lastReadMessageId,
  }),
};
