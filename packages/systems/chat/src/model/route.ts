import type { InkStep, ReduceContext } from '@narratives/foundation';
import { reduceStep } from '../reduce';
import type { ChatMessageVM } from '../reduce';
import type { ChatState } from '../state';

const DEFAULT_CHAT = 'main';

/** The conversation a `# chat:` tag switches to, or null if the step has none. */
export function readChatSwitch(step: InkStep): string | null {
  return step.tags.find((t) => t.key === 'chat')?.value ?? null;
}

// Resolve a message's owning chat: an explicit `# targetChat` overrides the
// conversation context (`activeChat`), which falls back to the default chat. A
// pure function of the step + the current context — the routing decision the
// `routingOwnership` invariant checks.
export function resolveChatId(step: InkStep, activeChat: string | null): string {
  const target = step.tags.find((t) => t.key === 'targetChat')?.value;
  return target ?? activeChat ?? DEFAULT_CHAT;
}

/** Build a message view-model, stamping identity (id + owning chatId) and time. */
export function buildMessage(
  step: InkStep,
  chatId: string,
  ctx: ReduceContext,
  time: number | null,
): ChatMessageVM {
  return { chatId, id: ctx.nextId(), time, ...reduceStep(step) };
}

// Append a message to its owning chat's history (immutably).
export function appendMessage(state: ChatState, message: ChatMessageVM): ChatState {
  const prev = state.messageHistory[message.chatId] ?? [];
  return {
    ...state,
    messageHistory: { ...state.messageHistory, [message.chatId]: [...prev, message] },
  };
}
