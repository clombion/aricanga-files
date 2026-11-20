import type { FixtureRun, Violation } from '@narratives/foundation/testing';
import { chatSystem, openedChat } from '#src/system';
import { declaredChatId, notificationOf, receiptChangeOf } from '#src/effects';
import type { ChatState } from '#src/state';
import type { ReduceRecord } from '@narratives/foundation';
import { entryOf } from '#src/model/keyed';
import { stateOf } from '@narratives/foundation';

// The chat physics invariants from docs/concepts/simulation-physics.md, as pure
// predicates over a completed run's observable Input→Effect+state stream. Authored
// here; each physics slice drives the reducer until its invariant holds. Each
// reads its natural observable: persistent values (routing, HWM cursor, the clock)
// over state; transient events (notifications) over effects. `receiptMonotonic`
// forward-declares the `chat/receiptChanged` effect read receipts (#13) emit.

/** The part of a completed run a predicate reads: the reduce trace, or the flattened effects. */
type Run = Pick<FixtureRun, 'effects' | 'trace'>;

/** The rank a receipt that names no known receipt takes: below `sent`, as `indexOf` reports it. */
const UNKNOWN_RECEIPT = -1;

/** Receipt monotonic (#13): a message receipt only advances sent, then delivered, then read; its rank is its place here. */
const RECEIPT_ORDER: readonly string[] = ['sent', 'delivered', 'read'];

/**
 * The chat state a trace record holds, read back through the chat system.
 *
 * @param {ReduceRecord} record - A trace record of the chat system.
 * @returns {ChatState} Its state, typed.
 */
function asChat(record: ReduceRecord): ChatState {
  return stateOf(chatSystem, { systemId: record.systemId, value: record.state });
}

/**
 * Whether a chat holds a message with this text, in its history or its deferred queue.
 *
 * @param {ChatState} state - The chat slice.
 * @param {string} chatId - The chat.
 * @param {string} text - The message's text.
 * @returns {boolean} Whether the chat owns such a message.
 */
function chatHolds(state: ChatState, chatId: string, text: string): boolean {
  const owned = [...(entryOf(state.messageHistory, chatId) ?? []), ...(entryOf(state.deferredMessages, chatId) ?? [])];
  return owned.some((message) => message.text === text);
}

/**
 * Routing: a message tagged `targetChat:X` reaches chat X. Ownership only: it lands in X's history
 * or its deferred queue (the defer branch may hold it); when to defer is the chat example tests'.
 *
 * @param {Run} run - A completed run.
 * @returns {Violation | undefined} The first message that missed its chat, or undefined.
 */
function routingOwnership(run: Run): Violation | undefined {
  for (const [at, record] of run.trace.entries()) {
    const { input } = record;
    const target = input.source === 'story' ? input.step.tags.find((tag) => tag.key === 'targetChat')?.value : undefined;
    if (input.source === 'story' && target !== undefined && input.step.text !== '' && !chatHolds(asChat(record), target, input.step.text)) {
      return { at, detail: `message for "${target}" reached neither history nor deferred`, rule: 'routing-ownership' };
    }
  }
  return undefined;
}

/**
 * The chats a record's effects notify.
 *
 * @param {ReduceRecord} record - A trace record.
 * @returns {readonly string[]} The notified chats, in effect order.
 */
function notifiedChats(record: ReduceRecord): readonly string[] {
  return record.effects.flatMap((effect) => {
    const notification = notificationOf(effect);
    return notification === undefined ? [] : [notification.chatId];
  });
}

/**
 * The chat a record's player command opens.
 *
 * @param {ReduceRecord} record - A trace record.
 * @returns {string | undefined} The opened chat, or undefined when the record opens none.
 */
function openedIn(record: ReduceRecord): string | undefined {
  return record.input.source === 'player' ? openedChat(record.input.command) : undefined;
}

/**
 * Notify-once: at most one notification per chat per epoch; an open clears the epoch.
 *
 * @param {Run} run - A completed run.
 * @returns {Violation | undefined} The first chat notified twice in an epoch, or undefined.
 */
function notifyOnce(run: Run): Violation | undefined {
  const notified = new Set<string>();
  for (const [at, record] of run.trace.entries()) {
    const opened = openedIn(record);
    if (opened !== undefined) {
      notified.delete(opened);
    }
    for (const chatId of notifiedChats(record)) {
      if (notified.has(chatId)) {
        return { at, detail: `chat "${chatId}" notified twice in one epoch`, rule: 'notify-once' };
      }
      notified.add(chatId);
    }
  }
  return undefined;
}

/**
 * Seed exclusion (#14): a seed init produces no notifications (historical, not new activity).
 *
 * @param {Run} run - A completed run.
 * @returns {Violation | undefined} The first seed init that notified, or undefined.
 */
function seedExclusion(run: Run): Violation | undefined {
  for (const [at, record] of run.trace.entries()) {
    const { input } = record;
    const isSeed = input.source === 'lifecycle' && input.lifecycle.kind === 'init';
    if (isSeed && record.effects.some((effect) => effect.kind === 'chat/showNotification')) {
      return { at, detail: 'seed init emitted a notification', rule: 'seed-exclusion' };
    }
  }
  return undefined;
}

/**
 * HWM monotonic: a read cursor, once after a message, never returns to the top (no un-reading).
 *
 * @param {Run} run - A completed run.
 * @returns {Violation | undefined} The first cursor that returned to the top, or undefined.
 */
function hwmMonotonic(run: Run): Violation | undefined {
  const read = new Set<string>();
  for (const [at, record] of run.trace.entries()) {
    for (const [chatId, cursor] of Object.entries(asChat(record).lastReadMessageId)) {
      if (cursor.at === 'after') {
        read.add(chatId);
      } else if (read.has(chatId)) {
        return { at, detail: `read cursor for "${chatId}" reset to the top`, rule: 'hwm-monotonic' };
      }
    }
  }
  return undefined;
}

/**
 * Forward-only time: simulation time never goes backward.
 *
 * @param {Run} run - A completed run.
 * @returns {Violation | undefined} The first record whose clock went backward, or undefined.
 */
function forwardOnlyTime(run: Run): Violation | undefined {
  let last = Number.NEGATIVE_INFINITY;
  for (const [at, record] of run.trace.entries()) {
    const { clock } = asChat(record);
    if (clock !== undefined) {
      if (clock < last) {
        return { at, detail: `clock went backward to ${clock} (was ${last})`, rule: 'forward-only-time' };
      }
      last = clock;
    }
  }
  return undefined;
}

/**
 * BUG-008, consumed by the typing indicator (#38): no chat effect that declares a chatId carries an
 * absent one (the typing-emission guard). Vacuous until #38 emits the typing effect; green over
 * today's `chat/showNotification`.
 *
 * @param {Run} run - A completed run.
 * @returns {Violation | undefined} The first chat effect with an absent chatId, or undefined.
 */
function effectsCarryChatId(run: Run): Violation | undefined {
  for (const effect of run.effects) {
    if (effect.kind.startsWith('chat/')) {
      const { declared, chatId } = declaredChatId(effect);
      if (declared && (chatId === null || chatId === undefined || chatId === '')) {
        return { detail: `effect "${effect.kind}" has an absent chatId`, rule: 'effects-carry-chatid' };
      }
    }
  }
  return undefined;
}

/**
 * Receipt monotonic (#13): a message receipt only advances sent, then delivered, then read.
 *
 * @param {Run} run - A completed run.
 * @returns {Violation | undefined} The first receipt that regressed, or undefined.
 */
function receiptMonotonic(run: Run): Violation | undefined {
  const seen = new Map<string, number>();
  for (const change of run.effects.map((effect) => receiptChangeOf(effect))) {
    if (change !== undefined) {
      const { messageId, receipt } = change;
      const rank = RECEIPT_ORDER.indexOf(receipt);
      if (rank < (seen.get(messageId) ?? UNKNOWN_RECEIPT)) {
        return { detail: `receipt for "${messageId}" regressed to "${receipt}"`, rule: 'receipt-monotonic' };
      }
      seen.set(messageId, rank);
    }
  }
  return undefined;
}

export { effectsCarryChatId, forwardOnlyTime, hwmMonotonic, notifyOnce, receiptMonotonic, routingOwnership, seedExclusion };
