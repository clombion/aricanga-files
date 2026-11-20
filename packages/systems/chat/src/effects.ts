/** The chat system's present effects: their kinds, their constructors and the parsers that read them back. */

import { type Effect, field, fx, hasField, text } from '@narratives/foundation';

export const CHAT_EFFECT = {
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

/** Notify the player of a message in a chat they are not viewing. */
export function showNotification(notification: Notification): Effect<'present', typeof CHAT_EFFECT.notification, Notification> {
  return fx.present(CHAT_EFFECT.notification, notification);
}

/** The notification an effect carries, or undefined for any other effect. */
export function notificationOf(effect: Effect): Notification | undefined {
  return effect.kind === CHAT_EFFECT.notification
    ? { chatId: text(effect.payload, 'chatId'), preview: text(effect.payload, 'preview') }
    : undefined;
}

/** The receipt change an effect carries, or undefined for any other effect. */
export function receiptChangeOf(effect: Effect): ReceiptChange | undefined {
  return effect.kind === CHAT_EFFECT.receipt
    ? { messageId: text(effect.payload, 'messageId'), receipt: text(effect.payload, 'receipt') }
    : undefined;
}

/** Whether a chat effect declares a chat id, and the value it declares. */
export function declaredChatId(effect: Effect): { readonly declared: boolean; readonly chatId: unknown } {
  return hasField(effect.payload, 'chatId')
    ? { declared: true, chatId: field(effect.payload, 'chatId') }
    : { declared: false, chatId: undefined };
}
