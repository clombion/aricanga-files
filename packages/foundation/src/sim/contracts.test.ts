import { decodeSnapshot, encodeSnapshot, fx, parseTag } from '@narratives/foundation';
import { describe, expect, test } from 'vitest';
import type { Snapshot } from '@narratives/foundation';

/** A snapshot whose every field differs from a default, so a dropped field is seen. */
const SNAPSHOT: Snapshot<{ chat: { count: number } }> = {
  idSeq: 7,
  ink: '{"x":1}',
  state: { chat: { count: 3 } },
  version: 1,
};

/** A scheduled commit with a non-zero delay and token. */
const COMMIT = { delayMs: 10, token: 2 } as const;

describe('the kernel contracts', () => {
  test('parseTag splits key/value and preserves raw', () => {
    expect.hasAssertions();
    expect(parseTag('speaker: Pat')).toStrictEqual({ key: 'speaker', raw: 'speaker: Pat', value: 'Pat' });
    expect(parseTag('immediate')).toStrictEqual({ key: 'immediate', raw: 'immediate' });
  });

  test('parseTag keeps every separator after the first in the value', () => {
    expect.hasAssertions();
    expect(parseTag('at: 10:30')).toStrictEqual({ key: 'at', raw: 'at: 10:30', value: '10:30' });
  });

  test('a snapshot round-trips through the codec to deep-equal', () => {
    expect.hasAssertions();
    expect(decodeSnapshot(encodeSnapshot(SNAPSHOT))).toStrictEqual(SNAPSHOT);
  });

  test('effect constructors tag the family and keep an open kind', () => {
    expect.hasAssertions();
    expect(fx.schedule(COMMIT)).toStrictEqual({ family: 'schedule', kind: 'commit', payload: COMMIT });
    expect(fx.present('chat/showNotification', { chatId: 'main' })).toStrictEqual({
      family: 'present',
      kind: 'chat/showNotification',
      payload: { chatId: 'main' },
    });
  });
});
