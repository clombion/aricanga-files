import { hasField, text } from '@narratives/foundation';
import type { Command, Effect, ReduceResult, System } from '@narratives/foundation';
import { isImmediate, placeMessage } from './model/defer';
import { closeWithReadState, openWithReadState } from './model/read-state';
import { buildMessage, readChatSwitch, resolveChatId } from './model/route';
import { advanceTime } from './model/time';
import { initChatState } from './state';
import type { ChatState } from './state';

// The chat player commands: open a chat (focus + clear-notified + replay) or
// close back to the hub.
/** @public */
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

/** @public */
export interface ChatViewModel {
  readonly view: ChatState['currentView'];
  readonly messages: ChatState['messageHistory'];
  // The read cursor per chat — the unread-separator anchor (absent = none,
  // null = before-all/top, id = after that id). Placement is derived in Phase 3.
  readonly lastRead: ChatState['lastReadMessageId'];
}

// Chat kernel (Phase 2). Routing (`# chat:` context, `# targetChat`
// override, owning-chat identity). Emergent notifications (notify-once),
// the deferred queue, `# immediate`, and the open/close lifecycle.
/**
 * The chat a recorded command opens, if it is an open command: a trace holds commands erased to
 * `Command`, so the module that owns `ChatCommand` reads one back.
 */
export function openedChat(command: Command): string | undefined {
  return command.kind === 'open' && hasField(command.payload, 'chatId') ? text(command.payload, 'chatId') : undefined;
}

export const chatSystem: System<ChatState, ChatCommand, Effect, ChatViewModel> = {
  id: 'chat',
  init: (_seed) => initChatState(),
  reduce(state, input, ctx): ReduceResult<ChatState> {
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

    // Advance the clock: `advance_day` fires even on a text-empty line, so run it
    // before the early return; message time-tags/drift apply only to a message.
    const timed = advanceTime(base, step);
    if (step.text === '') return { state: timed, effects: [] };

    const chatId = resolveChatId(step, timed.activeChat);
    const message = buildMessage(step, chatId, ctx, timed.clock);
    return placeMessage(timed, message, isImmediate(step));
  },
  status: () => 'free',
  tags: [...CHAT_TAGS],
  view: (state) => ({
    view: state.currentView,
    messages: state.messageHistory,
    lastRead: state.lastReadMessageId,
  }),
};
