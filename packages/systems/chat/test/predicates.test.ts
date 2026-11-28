import type { Effect, Input, ReduceRecord } from '@narratives/foundation';
import { describe, test } from 'vitest';
import {
  effectsCarryChatId,
  forwardOnlyTime,
  hwmMonotonic,
  notifyOnce,
  receiptMonotonic,
  routingOwnership,
  seedExclusion,
} from '#src/testing/predicates';
import { fx, parseTag } from '@narratives/foundation';
import type { ChatState } from '#src/state';
import { initChatState } from '#src/state';
import { open } from '#test/support';
import { showNotification } from '#src/effects';

/** The chat slice a run starts from. */
const START: ChatState = initChatState();

/** A clock reading, in minutes. */
const LATER = 600;

/** An earlier clock reading. */
const EARLIER = 540;

/**
 * A reduction of the chat system, as a predicate reads it.
 *
 * @param {Input} input - What the reduction took in.
 * @param {ChatState} state - The state it left.
 * @param {readonly Effect[]} effects - The effects it returned.
 * @returns {ReduceRecord} The record.
 */
function record(input: Input<unknown>, state: ChatState = START, effects: readonly Effect[] = []): ReduceRecord {
  return { effects, input, state, systemId: 'chat' };
}

/**
 * A story line with its raw tags.
 *
 * @param {string} text - The line.
 * @param {readonly string[]} tags - Its raw tags.
 * @returns {Input} The story input.
 */
function line(text: string, tags: readonly string[] = []): Input<unknown> {
  return { source: 'story', step: { choices: [], externalCalls: [], status: 'continue', tags: tags.map((raw) => parseTag(raw)), text } };
}

/** The player opens a chat. */
const OPEN_PAT: Input<unknown> = open('pat').input;

/** A notification for Pat's chat. */
const NOTIFY_PAT = showNotification({ chatId: 'pat', preview: 'hi' });

/**
 * A receipt change.
 *
 * @param {string} messageId - The message.
 * @param {string} word - Its receipt.
 * @returns {Effect} The effect.
 */
function receipt(messageId: string, word: string): Effect {
  return fx.present('chat/receiptChanged', { messageId, receipt: word });
}

describe('routing ownership', () => {
  test('fails a targeted line held by no chat, and passes an untargeted or empty one', ({ expect }) => {
    expect.hasAssertions();
    const emptyTargeted = record(line('', ['targetChat: pat']));
    const untargeted = record(line('hi'));
    const lost = record(line('hi', ['targetChat: pat']));
    expect(routingOwnership({ effects: [], trace: [emptyTargeted, untargeted, record(OPEN_PAT)] })).toBeUndefined();
    expect(routingOwnership({ effects: [], trace: [lost] })).toStrictEqual({
      at: 0,
      detail: 'message for "pat" reached neither history nor deferred',
      rule: 'routing-ownership',
    });
  });
});

describe('notify once', () => {
  test('fails a second notification in one epoch, and passes one after the chat was opened', ({ expect }) => {
    expect.hasAssertions();
    const twice = [record(line('a'), START, [NOTIFY_PAT, fx.present('chat/other', {})]), record(line('b'), START, [NOTIFY_PAT])];
    expect(notifyOnce({ effects: [], trace: twice })).toStrictEqual({
      at: 1,
      detail: 'chat "pat" notified twice in one epoch',
      rule: 'notify-once',
    });
    const reopened = [record(line('a'), START, [NOTIFY_PAT]), record(OPEN_PAT), record(line('b'), START, [NOTIFY_PAT])];
    expect(notifyOnce({ effects: [], trace: reopened })).toBeUndefined();
  });
});

describe('seed exclusion', () => {
  test('fails a notification from the seed init, and passes one from a reset', ({ expect }) => {
    expect.hasAssertions();
    const seeded = record({ lifecycle: { kind: 'init', seed: 0 }, source: 'lifecycle' }, START, [NOTIFY_PAT]);
    expect(seedExclusion({ effects: [], trace: [seeded] })).toStrictEqual({
      at: 0,
      detail: 'seed init emitted a notification',
      rule: 'seed-exclusion',
    });
    const reset = record({ lifecycle: { kind: 'reset' }, source: 'lifecycle' }, START, [NOTIFY_PAT]);
    const quiet = record({ lifecycle: { kind: 'init', seed: 0 }, source: 'lifecycle' });
    expect(seedExclusion({ effects: [], trace: [quiet, reset] })).toBeUndefined();
  });
});

describe('the read high-water mark', () => {
  test('fails a cursor that returns to the top after a read, and passes one never read', ({ expect }) => {
    expect.hasAssertions();
    const read: ChatState = { ...START, lastReadMessageId: { pat: { at: 'after', messageId: 'm1' } } };
    const top: ChatState = { ...START, lastReadMessageId: { pat: { at: 'top' }, sam: { at: 'top' } } };
    const readFirst = [record(line('a'), read), record(line('b'), top)];
    const topFirst = [record(line('a'), top), record(line('b'), read)];
    expect(hwmMonotonic({ effects: [], trace: topFirst })).toBeUndefined();
    expect(hwmMonotonic({ effects: [], trace: readFirst })).toStrictEqual({
      at: 1,
      detail: 'read cursor for "pat" reset to the top',
      rule: 'hwm-monotonic',
    });
  });
});

describe('forward-only time', () => {
  test('fails a clock that goes back, and passes an unanchored one', ({ expect }) => {
    expect.hasAssertions();
    const later = record(line('a'), { ...START, clock: LATER });
    const earlier = record(line('b'), { ...START, clock: EARLIER });
    const unanchored = record(line('x'));
    expect(forwardOnlyTime({ effects: [], trace: [unanchored, earlier, later] })).toBeUndefined();
    expect(forwardOnlyTime({ effects: [], trace: [later, earlier] })).toStrictEqual({
      at: 1,
      detail: `clock went backward to ${String(EARLIER)} (was ${String(LATER)})`,
      rule: 'forward-only-time',
    });
  });
});

describe('chat effects carry a chat id', () => {
  test('fails an empty chat id, and passes a chat effect with none declared and any other effect', ({ expect }) => {
    expect.hasAssertions();
    const passing = [NOTIFY_PAT, fx.present('chat/quiet', {}), fx.present('other/kind', { chatId: '' })];
    expect(effectsCarryChatId({ effects: passing, trace: [] })).toBeUndefined();
    expect(effectsCarryChatId({ effects: [fx.present('chat/showNotification', { chatId: '', preview: '' })], trace: [] })).toStrictEqual({
      detail: 'effect "chat/showNotification" has an absent chatId',
      rule: 'effects-carry-chatid',
    });
  });
});

describe('receipt monotonic', () => {
  test('passes receipts that advance, and fails one that regresses', ({ expect }) => {
    expect.hasAssertions();
    const advancing = [receipt('m1', 'sent'), NOTIFY_PAT, receipt('m1', 'delivered'), receipt('m1', 'read'), receipt('m2', 'sent')];
    expect(receiptMonotonic({ effects: advancing, trace: [] })).toBeUndefined();
    expect(receiptMonotonic({ effects: [receipt('m1', 'read'), receipt('m1', 'delivered')], trace: [] })).toStrictEqual({
      detail: 'receipt for "m1" regressed to "delivered"',
      rule: 'receipt-monotonic',
    });
  });

  test('ranks a receipt word it does not know below sent, Object.prototype members included', ({ expect }) => {
    expect.hasAssertions();
    expect(receiptMonotonic({ effects: [receipt('m1', 'sent'), receipt('m1', 'toString')], trace: [] })).toStrictEqual({
      detail: 'receipt for "m1" regressed to "toString"',
      rule: 'receipt-monotonic',
    });
  });
});
