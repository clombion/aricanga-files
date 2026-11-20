import { describe, expect, test } from 'vitest';
import type { FixtureRun } from '@narratives/foundation/testing';
import { fx } from '@narratives/foundation';
import { receiptMonotonic } from '@narratives/system-chat/testing';

/**
 * A run whose only effects are receipt changes of one message, in order.
 *
 * @param {readonly string[]} receipts - The receipts the message moves through.
 * @returns {Pick<FixtureRun, 'effects' | 'trace'>} The run the predicate reads.
 */
function receiptsRun(receipts: readonly string[]): Pick<FixtureRun, 'effects' | 'trace'> {
  return {
    effects: receipts.map((receipt) => fx.present('chat/receiptChanged', { messageId: 'm-1', receipt })),
    trace: [],
  };
}

describe('the receipt-monotonic predicate', () => {
  test('holds while a receipt only advances', () => {
    expect.hasAssertions();
    expect(receiptMonotonic(receiptsRun(['sent', 'delivered', 'read']))).toBeUndefined();
  });

  test('sees a receipt named after an Object.prototype member as unknown, so a fall to it regresses', () => {
    expect.hasAssertions();
    expect(receiptMonotonic(receiptsRun(['read', 'toString']))).toStrictEqual({
      detail: 'receipt for "m-1" regressed to "toString"',
      rule: 'receipt-monotonic',
    });
  });
});
