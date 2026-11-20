/** The chat system's present effects: their kinds, their constructors and the parsers that read them back. */

import { field, fx, hasField, text } from '@narratives/foundation';
import type { Effect } from '@narratives/foundation';

const CHAT_EFFECT = {
  notification: 'chat/showNotification',
  receipt: 'chat/receiptChanged',
} as const;

interface Notification {
  readonly chatId: string;
  readonly preview: string;
}

interface ReceiptChange {
  readonly messageId: string;
  readonly receipt: string;
}

/** Whether a chat effect declares a chat id, and the value it declares. */
interface DeclaredChatId {
  readonly declared: boolean;
  readonly chatId: unknown;
}

/**
 * Notify the player of a message in a chat they are not viewing.
 *
 * @param {Notification} notification - The chat and the message's preview.
 * @returns {Effect} The present effect carrying the notification.
 */
function showNotification(notification: Notification): Effect<'present', typeof CHAT_EFFECT.notification, Notification> {
  return fx.present(CHAT_EFFECT.notification, notification);
}

/**
 * The notification an effect carries.
 *
 * @param {Effect} effect - Any effect.
 * @returns {Notification | undefined} The notification, or undefined for any other effect.
 */
function notificationOf(effect: Readonly<Effect>): Notification | undefined {
  return effect.kind === CHAT_EFFECT.notification
    ? { chatId: text(effect.payload, 'chatId'), preview: text(effect.payload, 'preview') }
    : undefined;
}

/**
 * The receipt change an effect carries.
 *
 * @param {Effect} effect - Any effect.
 * @returns {ReceiptChange | undefined} The receipt change, or undefined for any other effect.
 */
function receiptChangeOf(effect: Readonly<Effect>): ReceiptChange | undefined {
  return effect.kind === CHAT_EFFECT.receipt
    ? { messageId: text(effect.payload, 'messageId'), receipt: text(effect.payload, 'receipt') }
    : undefined;
}

/**
 * Whether a chat effect declares a chat id, and the value it declares.
 *
 * @param {Effect} effect - A chat effect.
 * @returns {DeclaredChatId} Whether its payload has a `chatId` field, and that field's value.
 */
function declaredChatId(effect: Readonly<Effect>): DeclaredChatId {
  return hasField(effect.payload, 'chatId')
    ? { chatId: field(effect.payload, 'chatId'), declared: true }
    : { chatId: undefined, declared: false };
}

export { declaredChatId, notificationOf, receiptChangeOf, showNotification };
