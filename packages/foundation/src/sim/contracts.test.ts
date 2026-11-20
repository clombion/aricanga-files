import { decodeSnapshot, encodeSnapshot, fx, parseTag } from '@narratives/foundation';
import type { Snapshot } from '@narratives/foundation';
import { expect, test } from 'vitest';

test('parseTag splits key/value and preserves raw', () => {
  expect(parseTag('speaker: Pat')).toEqual({ key: 'speaker', raw: 'speaker: Pat', value: 'Pat' });
  expect(parseTag('immediate')).toEqual({ key: 'immediate', raw: 'immediate' });
});

test('a snapshot round-trips through the codec to deep-equal', () => {
  const snap: Snapshot<{ chat: { count: number } }> = {
    idSeq: 7,
    ink: '{"x":1}',
    state: { chat: { count: 3 } },
    version: 1,
  };
  expect(decodeSnapshot(encodeSnapshot(snap))).toEqual(snap);
});

test('effect constructors tag the family and keep an open kind', () => {
  expect(fx.schedule({ delayMs: 10, token: 2 })).toEqual({
    family: 'schedule',
    kind: 'commit',
    payload: { delayMs: 10, token: 2 },
  });
  expect(fx.present('chat/showNotification', { chatId: 'main' })).toEqual({
    family: 'present',
    kind: 'chat/showNotification',
    payload: { chatId: 'main' },
  });
});
