import type { Command, Effect, InkStep, ReduceResult, System } from '@narratives/foundation';
import { buildMessage, readChatSwitch, resolveChatId } from '#src/model/route';
import { closeWithReadState, openWithReadState } from '#src/model/read-state';
import { hasField, text } from '@narratives/foundation';
import { isImmediate, placeMessage } from '#src/model/defer';
import type { ChatState } from '#src/state';
import type { IdSource } from '#src/model/route';
import { advanceTime } from '#src/model/time';
import { initChatState } from '#src/state';

// The chat player commands: open a chat (focus + clear-notified + replay) or
// close back to the hub.
/** @public */
type ChatCommand = Command<'open', { readonly chatId: string }> | Command<'close', undefined>;

const CHAT_TAGS = ['chat', 'speaker', 'type', 'time', 'duration', 'targetChat', 'receipt', 'immediate'] as const;

/** @public */
interface ChatViewModel {
  readonly view: ChatState['currentView'];
  readonly messages: ChatState['messageHistory'];
  /**
   * The read cursor per chat, the unread separator's anchor: absent for none, `top` above every
   * message, `after` an id. Placement is derived in Phase 3.
   */
  readonly lastRead: ChatState['lastReadMessageId'];
}

/**
 * The chat a recorded command opens, if it is an open command: a trace holds commands erased to
 * `Command`, so the module that owns `ChatCommand` reads one back.
 *
 * @param {Command} command - A recorded command.
 * @returns {string | undefined} The chat it opens, or undefined for any other command.
 */
function openedChat(command: Readonly<Command>): string | undefined {
  return command.kind === 'open' && hasField(command.payload, 'chatId') ? text(command.payload, 'chatId') : undefined;
}

/**
 * Apply a player command: open a chat or close back to the hub.
 *
 * @param {ChatState} state - The chat slice.
 * @param {ChatCommand} command - The player's command.
 * @returns {ChatState} The slice after the command.
 */
function applyCommand(state: ChatState, command: Readonly<ChatCommand>): ChatState {
  return command.kind === 'open' ? openWithReadState(state, command.payload.chatId) : closeWithReadState(state);
}

/**
 * Apply a story step. A `# chat:` tag switches the conversation context for later messages. The
 * clock advances first: `advance_day` fires even on a text-empty line, so it runs before the early
 * return, while a message's time tags and drift apply only to a message.
 *
 * @param {ChatState} state - The chat slice.
 * @param {InkStep} step - The story step.
 * @param {IdSource} ids - The id source the message is stamped from.
 * @returns {ReduceResult<ChatState>} The slice with the message placed, and any notification.
 */
function applyStep(state: ChatState, step: InkStep, ids: IdSource): ReduceResult<ChatState> {
  const switched = readChatSwitch(step);
  const timed = advanceTime(switched === undefined ? state : { ...state, activeChat: switched }, step);
  if (step.text === '') {
    return { effects: [], state: timed };
  }
  const chatId = resolveChatId(step, timed.activeChat);
  return placeMessage(timed, buildMessage(step, { chatId, ids, time: timed.clock }), isImmediate(step));
}

// Chat kernel (Phase 2). Routing (`# chat:` context, `# targetChat`
// override, owning-chat identity). Emergent notifications (notify-once),
// the deferred queue, `# immediate`, and the open/close lifecycle.
const chatSystem: System<ChatState, ChatCommand, Effect, ChatViewModel> = {
  id: 'chat',
  init: () => initChatState(),
  reduce(state, input, ctx: IdSource): ReduceResult<ChatState> {
    if (input.source === 'player') {
      return { effects: [], state: applyCommand(state, input.command) };
    }
    if (input.source === 'story') {
      return applyStep(state, input.step, ctx);
    }
    return { effects: [], state };
  },
  status: () => 'free',
  tags: [...CHAT_TAGS],
  view: (state) => ({
    lastRead: state.lastReadMessageId,
    messages: state.messageHistory,
    view: state.currentView,
  }),
};

export { CHAT_TAGS, chatSystem, openedChat };
export type { ChatCommand, ChatViewModel };
