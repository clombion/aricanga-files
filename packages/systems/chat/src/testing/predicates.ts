import { hasField, type ReduceRecord, stateOf, text } from '@narratives/foundation';
import type { FixtureRun, Violation } from '@narratives/foundation/testing';
import { declaredChatId, notificationOf, receiptChangeOf } from '../effects';
import type { ChatState } from '../state';
import { chatSystem } from '../system';

// The chat physics invariants from docs/concepts/simulation-physics.md, as pure
// predicates over a completed run's observable Input→Effect+state stream. Authored
// here; each physics slice drives the reducer until its invariant holds. Each
// reads its natural observable: persistent values (routing, HWM cursor, the clock)
// over state; transient events (notifications) over effects. `receiptMonotonic`
// forward-declares the `chat/receiptChanged` effect read receipts (#13) emit.

/** The chat state a trace record holds, read back through the chat system. */
const asChat = (record: ReduceRecord): ChatState => stateOf(chatSystem, { systemId: record.systemId, value: record.state });

// Routing: a message tagged `targetChat:X` reaches chat X. Ownership-only — it
// lands in X's history OR its deferred queue (the defer branch may hold it); defer-
// correctness (when to defer) is covered by the chat example tests, not here.
export function routingOwnership(run: FixtureRun): Violation | null {
  let at = 0;
  for (const rec of run.trace) {
    const { input } = rec;
    if (input.source === 'story') {
      const target = input.step.tags.find((t) => t.key === 'targetChat')?.value;
      if (target !== undefined && input.step.text !== '') {
        const state = asChat(rec);
        const inHistory = (state.messageHistory[target] ?? []).some((m) => m.text === input.step.text);
        const inDeferred = (state.deferredMessages[target] ?? []).some((m) => m.text === input.step.text);
        if (!inHistory && !inDeferred) {
          return { rule: 'routing-ownership', detail: `message for "${target}" reached neither history nor deferred`, at };
        }
      }
    }
    at += 1;
  }
  return null;
}

// Notify-once: at most one notification per chat per epoch; an open clears the epoch.
export function notifyOnce(run: FixtureRun): Violation | null {
  const notified = new Set<string>();
  let at = 0;
  for (const rec of run.trace) {
    const { input } = rec;
    if (input.source === 'player' && input.command.kind === 'open') {
      const { payload } = input.command;
      const chatId = hasField(payload, 'chatId') ? text(payload, 'chatId') : undefined;
      if (chatId !== undefined) notified.delete(chatId);
    }
    for (const eff of rec.effects) {
      const notification = notificationOf(eff);
      if (notification !== undefined) {
        const { chatId } = notification;
        if (notified.has(chatId)) {
          return { rule: 'notify-once', detail: `chat "${chatId}" notified twice in one epoch`, at };
        }
        notified.add(chatId);
      }
    }
    at += 1;
  }
  return null;
}

// Seed exclusion (#14): a seed init produces no notifications (historical, not new activity).
export function seedExclusion(run: FixtureRun): Violation | null {
  let at = 0;
  for (const rec of run.trace) {
    const { input } = rec;
    if (input.source === 'lifecycle' && input.lifecycle.kind === 'init') {
      if (rec.effects.some((e) => e.kind === 'chat/showNotification')) {
        return { rule: 'seed-exclusion', detail: 'seed init emitted a notification', at };
      }
    }
    at += 1;
  }
  return null;
}

// HWM monotonic: a read cursor, once set for a chat, never resets to null (no un-reading).
export function hwmMonotonic(run: FixtureRun): Violation | null {
  const set = new Set<string>();
  let at = 0;
  for (const rec of run.trace) {
    for (const [chatId, cursor] of Object.entries(asChat(rec).lastReadMessageId)) {
      if (cursor !== null) set.add(chatId);
      else if (set.has(chatId)) {
        return { rule: 'hwm-monotonic', detail: `read cursor for "${chatId}" reset to null`, at };
      }
    }
    at += 1;
  }
  return null;
}

// Forward-only time: simulation time never goes backward.
export function forwardOnlyTime(run: FixtureRun): Violation | null {
  let last = Number.NEGATIVE_INFINITY;
  let at = 0;
  for (const rec of run.trace) {
    const { clock } = asChat(rec);
    if (clock !== null) {
      if (clock < last) {
        return { rule: 'forward-only-time', detail: `clock went backward to ${clock} (was ${last})`, at };
      }
      last = clock;
    }
    at += 1;
  }
  return null;
}

// BUG-008, consumed by the typing indicator (#38): no chat effect that declares a chatId
// carries a null/absent one (the typing-emission guard). Vacuous until #38
// emits the typing effect; green over today's `chat/showNotification`.
export function effectsCarryChatId(run: FixtureRun): Violation | null {
  for (const eff of run.effects) {
    if (eff.kind.startsWith('chat/')) {
      const { declared, chatId } = declaredChatId(eff);
      if (declared && (chatId === null || chatId === undefined || chatId === '')) {
        return { rule: 'effects-carry-chatid', detail: `effect "${eff.kind}" has an absent chatId` };
      }
    }
  }
  return null;
}

// Receipt monotonic (#13): a message receipt only advances sent → delivered → read.
const RECEIPT_RANK: Readonly<Record<string, number>> = { sent: 0, delivered: 1, read: 2 };
export function receiptMonotonic(run: FixtureRun): Violation | null {
  const seen = new Map<string, number>();
  for (const eff of run.effects) {
    const change = receiptChangeOf(eff);
    if (change !== undefined) {
      const { messageId, receipt } = change;
      const rank = RECEIPT_RANK[receipt] ?? -1;
      const prev = seen.get(messageId) ?? -1;
      if (rank < prev) {
        return { rule: 'receipt-monotonic', detail: `receipt for "${messageId}" regressed to "${receipt}"` };
      }
      seen.set(messageId, rank);
    }
  }
  return null;
}
