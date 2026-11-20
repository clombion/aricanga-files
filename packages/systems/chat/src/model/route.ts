import type { InkStep, ReduceContext } from '@narratives/foundation';
import type { ChatMessageVM } from '#src/reduce';
import type { ChatState } from '#src/state';
import { entryOf } from '#src/model/keyed';
import { reduceStep } from '#src/reduce';

const DEFAULT_CHAT = 'main';

/** The id source a message is stamped from: the reduce context's allocator. */
interface IdSource {
  readonly nextId: ReduceContext['nextId'];
}

/** Where a message is placed: its owning chat, the id source, and the clock when it arrived. */
interface Placement {
  readonly chatId: string;
  readonly ids: IdSource;
  readonly time: number | undefined;
}

/**
 * The conversation a `# chat:` tag switches to.
 *
 * @param {InkStep} step - The ink step.
 * @returns {string | undefined} The tag's chat, or undefined if the step has none.
 */
function readChatSwitch(step: InkStep): string | undefined {
  return step.tags.find((tag) => tag.key === 'chat')?.value;
}

/**
 * Resolve a message's owning chat: an explicit `# targetChat` overrides the conversation context
 * (`activeChat`), which falls back to the default chat. A pure function of the step and the
 * current context: the routing decision the `routingOwnership` invariant checks.
 *
 * @param {InkStep} step - The ink step a message comes from.
 * @param {string | undefined} activeChat - The conversation the story is in, if any.
 * @returns {string} The chat that owns the message.
 */
function resolveChatId(step: InkStep, activeChat: string | undefined): string {
  const target = step.tags.find((tag) => tag.key === 'targetChat')?.value;
  return target ?? activeChat ?? DEFAULT_CHAT;
}

/**
 * Build a message view-model, stamping identity (id and owning chatId) and time.
 *
 * @param {InkStep} step - The ink step a message comes from.
 * @param {Placement} placement - Its owning chat, the id source, and the clock.
 * @returns {ChatMessageVM} The message, timed when the clock is anchored.
 */
function buildMessage(step: InkStep, placement: Placement): ChatMessageVM {
  const { chatId, ids, time } = placement;
  const fields = { chatId, id: ids.nextId(), ...reduceStep(step) };
  return time === undefined ? fields : { ...fields, time };
}

/**
 * Append a message to its owning chat's history, immutably.
 *
 * @param {ChatState} state - The chat slice.
 * @param {ChatMessageVM} message - The message to append.
 * @returns {ChatState} The slice with the message at the end of its chat's history.
 */
function appendMessage(state: ChatState, message: ChatMessageVM): ChatState {
  const prev = entryOf(state.messageHistory, message.chatId) ?? [];
  return {
    ...state,
    messageHistory: { ...state.messageHistory, [message.chatId]: [...prev, message] },
  };
}

export { appendMessage, buildMessage, readChatSwitch, resolveChatId };
export type { IdSource };
